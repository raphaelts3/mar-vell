const passport = require("passport");
const OAuth2Strategy = require("passport-oauth").OAuth2Strategy;
const jwt = require("jsonwebtoken");
const axios = require("axios");
const webhook = require("./webhook");
const token = require("../common/token");

// Override passport profile function to get user profile from Twitch API
OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
  const options = {
    url: "https://api.twitch.tv/helix/users",
    method: "GET",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Accept: "application/vnd.twitchtv.v5+json",
      Authorization: "Bearer " + accessToken,
    },
  };

  axios(options)
    .then(function (response) {
      done(null, response.data);
    })
    .catch(function (error) {
      done(JSON.parse(error.response.data));
    });
};

// Override passport serializer, because the data is already good
passport.serializeUser(function (user, done) {
  done(null, user);
});

// Override passport deserializer, because the data is already good
passport.deserializeUser(function (user, done) {
  done(null, user);
});

// Defines the strategy for "twitch" OAuth method
passport.use(
  "twitch",
  new OAuth2Strategy(
    {
      authorizationURL: "https://id.twitch.tv/oauth2/authorize",
      tokenURL: "https://id.twitch.tv/oauth2/token",
      clientID: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URI}/auth/twitch/callback`,
      state: true,
    },
    function (accessToken, refreshToken, profile, done) {
      // Save accessToken and refreshToken on profile data
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      // TODO: Profile could be saved in our database to be used later
      done(null, profile);
    }
  )
);

// Function to properly setup the authentication part on the application
function setup(app) {
  app.use(passport.initialize());
  app.use(passport.session());

  // This route will receive the redirect after the streamer successfully
  // give permission to the application "Mar-Vell Bot" and then it will
  // try to subscribe into the user webhooks
  app.get("/auth", function (req, res) {
    if (req.session && req.session.passport && req.session.passport.user) {
      console.debug(JSON.stringify(req.session.passport.user));
      res.send("You're good to go! :-)");
      webhook.subscribeToWebHooks(req.session.passport.user);
    } else {
      res.status(404).send({});
    }
  });

  // Set route for OAuth redirect, this is the URL redirected from
  // twitch authentication and will basically redirect to /auth
  app.get(
    "/auth/twitch/callback",
    passport.authenticate("twitch", {
      successRedirect: "/auth",
      failureRedirect: "/auth",
    })
  );

  // Set route to start OAuth link, this is where you define scopes to request
  app.get("/auth/twitch/:token", function (req, res, next) {
    // Validate the informed token
    token.verify(req.params.token, function (err) {
      if (err) {
        res.status(404).send();
        return;
      }
      // Proceed with OAuth process
      passport.authenticate("twitch", {
        scope: "user:read:email channel:moderate chat:edit chat:read",
      })(req, res, next);
    });
  });
}

module.exports = {
  setup,
};
