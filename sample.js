//new passport method also you need clientId and clientSecret for your app from google
// change identifier to id in server.js
passport.use(new GoogleStrategy({
  clientId: 'id from google credential',
    clientSecret: 'secret from google credential',
    callbackURL: 'http://localhost:3000/auth/google/return',
  },
  function(accessToken, refreshToken, profile, done) {
      done(null, profile);
  }
));

// old passport method
passport.use(new GoogleStrategy({
		returnURL: 'http://localhost:3000/auth/google/return',
		realm: 'http://localhost:3000/'
	},
	function(identifier, profile, done) {
		profile.identifier = identifier;
		return done(null, profile);
	}
));