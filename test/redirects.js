// Runs a very simple crawl on an HTTP server with different depth

var chai = require("chai");
    chai.should();

var testserver = require("./lib/testserver.js");

var Crawler	= require("../");

// Test the number of links fetched for the given "maxRedir" and compare it to "linksToFetch"
var redirTest = function(maxRedir, linksToFetch) {
	maxRedir = parseInt(maxRedir); // Force maxRedir to be a number

	var crawler;
	var linksFetched;

	describe("maxSameRedirects "+ maxRedir, function() {
		before(function() {
			// Create a new crawler to crawl our local test server
			crawler = new Crawler("127.0.0.1","/redir-loop",3000);

			// Speed up tests. No point waiting for every request when we're running
			// our own server.
			crawler.interval = 1;

			// Define max depth for this crawl
			crawler.maxSameRedirects = maxRedir;

			linksFetched = 0;

			crawler.on("fetchheaders",function(queueItem) {
				linksFetched++;
			});

			crawler.start();
		});

		after(function() {
			// Clean listeners and crawler
			crawler.removeAllListeners("fetchheaders");
			crawler.removeAllListeners("complete");
			crawler = null;
		});

		it("should fetch "+ linksToFetch +" resources",function(done) {
			crawler.on("complete",function() {
				linksFetched.should.equal(linksToFetch);
				done();
			});
		});
	});
};

describe("Crawler max same redirects",function() {

	// maxRedir: linksToFetch
	var linksToFetch = {
		0: 1,
		1: 2
	};

	for(var maxRedir in linksToFetch) {
		redirTest(maxRedir, linksToFetch[maxRedir]);
	}

});