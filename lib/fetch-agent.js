/**
 * @file simplecrawler's fetch agent module
 */

var    AbortController = require("abort-controller");
/**
 * Creates a new fetchAgent which is wrapper for different fetch modules.
 * @class
 */
var FetchAgent = function() {

    /**
     * Setup underlying fetch for the crawler. Refer [MDN documentation]{@link https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API}
     * @name FetchAgent.fetch
     * @public
     * @type {fetch}
     */
    Object.defineProperty(this, "fetch", {
        enumerable: false,
        writable: false,
        value: require("node-fetch")
    });

    /**
     * customize fetch with options.
     * redirect: Set it with (follow/error/manual) to define redirect behavior.
     * abortController: Set it to @type {AbortController} to customize abort of request.
     * @name FetchQueue.
     * @public
     * @type {Object}
     */
    Object.defineProperty(this, "options", {
        enumerable: false,
        writable: false,
        value: {
            redirect: "manual",
            abortController : AbortController
        }
    });
};

module.exports = FetchAgent;
