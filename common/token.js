require("dotenv").config();

const jwt = require("jsonwebtoken");

module.exports = {
  verify: (token, callback) => {
    return jwt.verify(
      Buffer.from(token, "base64").toString(),
      process.env.MARVELL_SECRET,
      {
        ignoreExpiration: false,
        maxAge: Number.parseInt(process.env.TOKEN_TIMEOUT),
      },
      callback
    );
  },
  generate: (data = {}) => {
    const token = jwt.sign(data, process.env.MARVELL_SECRET, {
      expiresIn: Number.parseInt(process.env.TOKEN_TIMEOUT),
    });
    return Buffer.from(token).toString("base64");
  },
};
