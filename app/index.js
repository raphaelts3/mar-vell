require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");

// Initialize Express and middlewares
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// Parse application/json, but also keep the rawBody to verify Twitch webhooks
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Load auth routes
require("./auth").setup(app);
// Load webhook routes
require("./webhook").setup(app);

// Only used to handle letsencrypt validations =)
app.get(
  `/.well-known/acme-challenge/${process.env.ACME_CHALLENGE_FILE}`,
  function (req, res) {
    res.type("plain/txt").send(process.env.ACME_FILE_CONTENT);
  }
);

// Redirect the index route to your repository
app.get("/", function (req, res) {
  res.redirect("https://github.com/raphaelts3/mar-vell");
});

// Start the web server listener
app.listen(process.env.PORT || 3000, function () {
  console.log("Mar-Vell Bot up and running!");
});
