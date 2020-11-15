const passport = require("passport");
const OAuth2Strategy = require("passport-oauth").OAuth2Strategy;
const jwt = require("jsonwebtoken");
const axios = require("axios");
const webhook = require("./webhook");

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

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

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
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      done(null, profile);
    }
  )
);

module.exports = {
  setup: function (app) {
    app.use(passport.initialize());
    app.use(passport.session());

    app.get("/auth", function (req, res) {
      if (req.session && req.session.passport && req.session.passport.user) {
        console.debug(JSON.stringify(req.session.passport.user));
        res.send("You're good to go! :-)");
        webhook.subscribeToBans(req.session.passport.user).catch(console.error);
      } else {
        res.status(404).send({});
      }
    });

    // Set route for OAuth redirect
    app.get(
      "/auth/twitch/callback",
      passport.authenticate("twitch", {
        successRedirect: "/auth",
        failureRedirect: "/auth",
      })
    );

    // Set route to start OAuth link, this is where you define scopes to request
    app.get("/auth/twitch/:token", function (req, res, next) {
      if (req.params.token === undefined) {
        res.status(404).send({});
        return;
      }
      jwt.verify(
        Buffer.from(req.params.token, "base64").toString(),
        process.env.MARVELL_SECRET,
        { ignoreExpiration: false, maxAge: Number.parseInt(process.env.TOKEN_TIMEOUT) },
        function (err, decoded) {
          if (err) {
            console.log(err);
            res.status(404).send({});
            return;
          }
          passport.authenticate("twitch", {
            scope: "user:read:email channel:moderate chat:edit chat:read",
          })(req, res, next);
        }
      );
    });
  },
};
