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
// Parse application/json
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

app.get(`/.well-known/acme-challenge/${process.env.ACME_CHALLENGE_FILE}`, function (req, res) {
  res.type("plain/txt").send(process.env.ACME_FILE_CONTENT);
});

// If user has an authenticated session, display it, otherwise display link to authenticate
app.get("/", function (req, res) {
  res.redirect("https://github.com/raphaelts3/mar-vell");
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Mar-Vell Bot up and running!");
});
