'use strict';
const request = require('request');
module.exports = function(config, app) {
	app.get('/api/search/:view', function(req, res) {
		let allowed_views = ["author", "subject"];
		if (allowed_views.indexOf(req.params.view) === -1) {
			res.json(400, { error: "bad_request", reason: "invalid view" });
			return;
		}
		request({
			method: 'GET',
			url: config.bookdb + '_design/books/_view/by_' + req.params.view,
			qs: {
				startkey: JSON.stringify(req.query.q),
				endkey: JSON.stringify(req.query.q + "\ufff0"),
				group: true
			}
		}, function(err, couchRes, body) {

			// couldn't connect to CouchDB
			if (err) {
				res.json(502, { error: "bad_gateway", reason: err.code });
				return;
			}

			// CouchDB couldn't process our request
			if (couchRes.statusCode !== 200) {
				res.status(couchRes.statusCode).json(JSON.parse(body));
				return;
			}

			// send back just the keys we got back from CouchDB
			res.json(JSON.parse(body).rows.map(function(elem){
				return elem.key;
			}));

		});
	});
};
