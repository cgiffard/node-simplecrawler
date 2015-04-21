/*global clearInterval, console, phantom, require, setInterval*/

var webpage = require('webpage'),
system = require('system'),

// Setup our app.
app = {
	page: webpage.create(),
	timeout: 10000, // 10 seconds is the default.
	userAgent: null,
	url: null
};

// Startup function.
app.initialize = function() {
	app.parseArgs();
	app.pageDefaults();
	app.pageEvents();
	app.pageRun();
};

// Set our page defaults.
app.pageDefaults = function() {
	// Set our timeout.
	if (app.timeout) {
		app.page.settings.resourceTimeout = app.timeout;
	}

	// Set our user agent.
	if (app.userAgent) {
		app.page.settings.userAgent = app.userAgent;
	}
};

// Attach our pages events.
app.pageEvents = function() {
	var receivedCount = 0;
	var receivedLast = new Date().getTime();

	var requestCount = 0;
	var requestIds = [];

	var startTime = new Date().getTime();

	// Process incoming resources.
	app.page.onResourceReceived = function (response) {
		if (requestIds.indexOf(response.id) !== -1) {
			receivedCount++;
			receivedLast = new Date().getTime();

			requestIds[requestIds.indexOf(response.id)] = null;
		}
	};

	// Update our request count.
	app.page.onResourceRequested = function (request) {
		if (requestIds.indexOf(request.id) === -1) {
			requestIds.push(request.id);
			requestCount++;
		}
	};

	// If our request times out, exit.
	app.page.onResourceTimeout = function() {
		console.log('ERROR: Resource timed out! (' + app.timeout + 'ms)');
		phantom.exit(-1);
	};

	var check = function() {
		// Don't return until all requests are finished.
		if (new Date().getTime() - receivedLast > 300 && requestCount === receivedCount) {
			clearInterval(checkInterval);
			console.log(app.page.content);
			phantom.exit();
		}

		// If we hit our timeout, exit.
		if (new Date().getTime() - startTime > app.timeout) {
			console.log('ERROR: Resource timed out! (' + app.timeout + 'ms)');
			phantom.exit(-1);
		}
	};

	// Let us check to see if the page is finished rendering
	var checkInterval = setInterval(check, 1);
};

// Request our page.
app.pageRun = function(callback) {
	app.page.open(app.url, callback);
};

// Handle arguments that passed in.
app.parseArgs = function() {
	system.args.forEach(function (arg) {
		if (arg.substr(0, 2) !== '--') {
			return;
		}

		arg = arg.substr(2).split('=');

		var variable = arg[0];
		var value = arg[1];

		if (value === null || value === '') {
			return;
		}

		switch (variable) {
			case 'timeout':
				app.timeout = value;
				break;

			case 'useragent':
				app.userAgent = value;
				break;

			case 'url':
				app.url = value;
				break;
		}
	});
};

// Initiate our app.
app.initialize();