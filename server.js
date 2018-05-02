#!/usr/bin/env node-harmony
'use strict';

const
	express = require('express'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	morgan = require('morgan'),
	bodyParser = require('body-parser'),
	app = express(),
	request = require('request'),

	redisClient = require('redis').createClient(),
	RedisStore = require('connect-redis')(session),

	passport = require('passport'),
	GoogleStrategy = require('passport-google-auth').Strategy,
	log = require('npmlog');

redisClient
	.on('ready', function() { log.info('REDIS', 'ready'); })
	.on('error', function(err) { log.error('REDIS', err.message); });

//what gets stored in session
passport.serializeUser(function(user, done) {
	done(null, user.id);
});
//take the session data and convert it into rich
//data object to be used by our app
passport.deserializeUser(function(id, done) {
	done(null, { id: id });
});
passport.use(new GoogleStrategy({
	clientId: '204549746462-hd2ck9ccbrcdsf6hmgkoam8r30jqccjr.apps.googleusercontent.com',
    clientSecret: '1rKhXlNYeKBGeUQ4rSpa5Ro0',
    callbackURL: 'http://localhost:3000/auth/google/return',
  },
  function(accessToken, refreshToken, profile, done) {
   done(null, profile);
  }
));

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(session({
	secret: 'unguessable',
	store: new RedisStore({
		client: redisClient
	}),
	resave: true,
	saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/static'));
app.use(express.static(__dirname + '/bower_components'));

const config = {
	bookdb: 'http://localhost:5984/books/',
	b4db: 'http://localhost:5984/b4/'
};
require('./lib/book-search.js')(config, app);
require('./lib/field-search.js')(config, app);
require('./lib/bundle.js')(config, app);

app.get('/auth/google/:return?',
	passport.authenticate('google', { successRedirect: '/' })
);
app.get('/auth/logout', function(req, res){
	req.session.destroy(function() {
		res.redirect('https://www.google.com/accounts/Logout?continue=https://appengine.google.com/_ah/logout?continue=http://localhost:3000/');
	})
});

const authed = function(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	} else if (redisClient.ready) {
		res.json(403, {
			error: "forbidden",
			reason: "not_authenticated"
		});
	} else {
		res.json(503, {
			error: "service_unavailable",
			reason: "authentication_unavailable"
		});
	}
};

app.get('/api/user', authed, function(req, res){
	res.json(req.user);
});

app.get('/api/user/bundles', authed, function(req, res) {
	let userURL = config.b4db + encodeURIComponent(req.user.id);
	request(userURL, function(err, couchRes, body) {
		if (err) {
			res.status(502).json({ error: "bad_gateway", reason: err.code });
		} else if (couchRes.statusCode === 200) {
			res.json(JSON.parse(body).bundles || {});
		} else {
			res.status(couchRes.statusCode).send(body);
		}
	});
});

app.put('/api/user/bundles', [authed, bodyParser.json()], function(req, res) {
	let userURL = config.b4db + encodeURIComponent(req.user.id);
	request(userURL, function(err, couchRes, body) {
		if (err) {
			res.status(502).json({ error: "bad_gateway", reason: err.code });
		} else if (couchRes.statusCode === 200) {
			let user = JSON.parse(body);
			user.bundles = req.body;
			request.put({ url: userURL, json: user }).pipe(res);
		} else if (couchRes.statusCode === 404) {
			let user = { bundles: req.body };
			request.put({ url: userURL,	json: user }).pipe(res);
		} else {
			res.status(couchRes.statusCode).send(body);
		}
	});
});

app.listen(3000, function(){
	console.log("ready captain.");
});
