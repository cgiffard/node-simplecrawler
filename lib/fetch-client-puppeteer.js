const puppeteer = require("puppeteer");
const { AuthenticationBasic } = require("./authentication");

class FetchClientPuppeteer {
    /**
     *
     * @param {Crawler} crawler
     */
    constructor(crawler) {
        this._crawler = crawler;
        this._browser = null;
    }

    /**
     * Starts a new browser for puppeteer or reuses the the running instance
     * @returns {Promise<Browser>}
     */
    browser() {
        if (!this._browser) {
            const options = {
                headless: true,
                ignoreHTTPSErrors: this._crawler.ignoreInvalidSSL
            };
            let proxyUrl = this._proxyUrl();
            if (proxyUrl) {
                let args = [`--proxy-server=${proxyUrl}`];
                options.args = args;
            }
            this._browser = puppeteer.launch(options).catch((error) => {
                throw error;
            });
        }
        return this._browser;
    }

    /**
     * Fetches the url specified in the queueItem
     * @param queueItem
     * @return {Void}
     */
    fetch(queueItem) {
        this._crawler.queue.update(queueItem.id, {
            status: "spooled"
        }, (error, queueItem) => {
            if (error) {
                return this._crawler.emit("queueerror", error, queueItem);
            }

            this.browser().then((browser) => {
                browser.newPage().then((page) => {
                    const timeCommenced = Date.now();
                    const options = {
                        timeout: this._crawler.timeout,
                        waitUntil: "networkidle",
                        networkIdleInflight: 0
                    };
                    page.authenticate(this._basicAuthCredentials(queueItem.host)).then(() => {
                        page.goto(queueItem.url, options)
                            .then((response) => {
                                // _openRequests.length is used for rate limiting in crawler
                                this._crawler._openRequests.push(response._request);
                                this._fixResponse(response);
                                this.handleResponse(queueItem, response, timeCommenced, page);
                            })
                            .catch((error) => {
                                if (error.message.match(/timeout/i)) {
                                    this._onTimeout(error, queueItem);
                                } else {
                                    this._onError(error, queueItem);
                                }
                                this._cleanup(page);
                            });
                    });
                });
            });
        });
    }

    /**
     * Handles the response of the item fetched via fetch()
     * @param queueItem
     * @param response
     * @param timeCommenced
     * @param page
     */
    handleResponse(queueItem, response, timeCommenced, page) {
        const timeHeadersReceived = Date.now();
        let responseLength;

        timeCommenced = timeCommenced || Date.now();
        responseLength = Number(response.headers["content-length"]);
        responseLength = !isNaN(responseLength) ? responseLength : 0;

        this._crawler.queue.update(queueItem.id, {
            stateData: {
                requestLatency: timeHeadersReceived - timeCommenced,
                requestTime: timeHeadersReceived - timeCommenced,
                contentLength: responseLength,
                contentType: response.headers["content-type"],
                code: response.status,
                headers: response.headers
            }
        }, (error, queueItem) => {
            if (error) {
                return this._crawler.emit("queueerror", error, queueItem);
            }
            this._crawler.emit("fetchheaders", queueItem, response);
        });
        this._crawler.queue.update(queueItem.id, {
            fetched: true,
            status: "downloaded"
        }, (error, queueItem) => {
            if (error) {
                return this._crawler.emit("queueerror", error, queueItem);
            }

            /**
             * Fired when the request has completed
             * @event Crawler#fetchcomplete
             * @param {QueueItem} queueItem           The queue item for which the request has completed
             * @param {String} responseBody
             * @param {Response} response
             */
            page.content().then((responseBody) => {
                this._crawler.emit("fetchcomplete", queueItem, responseBody, response);
                this._cleanup(page, response);
            });
        });
    }

    /**
     * Returns a proxy URL with the format:
     * http://username:password@hostname:port
     * @return {String}
     * @private
     */
    _proxyUrl() {
        let proxyUrl = [];
        if (this._crawler.useProxy) {
            proxyUrl.push("http://");
            if (this._crawler.proxyUser !== null && this._crawler.proxyPass !== null) {
                proxyUrl.push(`${this._crawler.proxyUser}:${this._crawler.proxyPass}@`);
            }
            proxyUrl.push(`${this._crawler.proxyHostname}:${this._crawler.proxyPort}`);
        }
        return proxyUrl.length ? proxyUrl.join("") : null;
    }

    /**
     * Handle resources cleanup once we're done fetching the resource
     * @param  {Page} page
     * @param {Response} response
     * @return {Promise} when the page is closed
     * @private
     */
    _cleanup(page, response = null) {
        if (response) {
            this._crawler._openRequests.splice(this._crawler._openRequests.indexOf(response._request), 1);
        }
        return page.close();
    }

    /**
     * Returns the basic auth credentials for the host if there are any.
     * @param{String} host
     * @param {Page} page
     * @returns {Object|null} credentials or null if the host needs none
     * @private
     */
    _basicAuthCredentials(host) {
        if (this._crawler.authentications.hasAuthFor(host)) {
            const authConfig = this._crawler.authentications.getAuthFor(host);
            if (authConfig instanceof AuthenticationBasic) {
                return {
                    username: authConfig.username(),
                    password: authConfig.password()
                };
            }
        }
        return null;
    }

    /**
     * The configured crawler timeout has expired.
     * @param error
     * @param {QueueItem} queueItem
     * @private
     */
    _onTimeout(error, queueItem) {
        this._crawler.queue.update(queueItem.id, {
            fetched: true,
            status: "timeout"
        }, (error, queueItem) => {
            if (error) {
                return this._crawler.emit("queueerror", error, queueItem);
            }

            /**
             * Fired when a request times out
             * @event Crawler#fetchtimeout
             * @param {QueueItem} queueItem The queue item for which the request timed out
             * @param {Number} timeout      The delay in milliseconds after which the request timed out
             */
            this._crawler.emit("fetchtimeout", queueItem, this._crawler.timeout);
        });
    }

    /**
     * Unknown error prevented the fetch operation.
     * @param pageError
     * @param {QueueItem} queueItem
     * @private
     */
    _onError(pageError, queueItem) {
        this._crawler.queue.update(queueItem.id, {
            fetched: true,
            status: "failed",
            stateData: {
                code: 600
            }
        }, (queueError, queueItem) => {
            if (queueError) {
                return this._crawler.emit("queueerror", queueError, queueItem);
            }
        });
        /**
         * Fired when a request encounters an unknown error
         * @event Crawler#fetchclienterror
         * @param {QueueItem} queueItem The queue item for which the request has errored
         * @param {Object} error        The error supplied to the `error` event on the request
         */
        this._crawler.emit("fetchclienterror", queueItem, pageError);
    }

    /**
     * Adds properties to the request object from puppeteer to more closely match those of the request
     * as returned by Node.js' http client request instance
     * This is a hack to make the existing crawler code "work"
     * @param response
     * @private
     */
    _fixResponse(response) {
        // hacks to make interfaces compatible with the existing crawler to some extent
        // add aliases for properties to make puppeteers interface for responses match that of node.js
        Object.defineProperty(response, "statusCode", {
            get: function () {
                return this.status;
            }
        });
        Object.defineProperty(response, "req", {
            get: function () {
                return this._request;
            }
        });
        Object.defineProperty(response._request, "_headers", {
            get: function () {
                return this.headers;
            }
        });
    }
}

module.exports = FetchClientPuppeteer;
