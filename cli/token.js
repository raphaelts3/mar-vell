require("dotenv").config();

const jwt = require("jsonwebtoken");
const token = jwt.sign({}, process.env.MARVELL_SECRET, {
  expiresIn: Number.parseInt(process.env.TOKEN_TIMEOUT),
});
const hashed = Buffer.from(token).toString("base64");
console.log(hashed);

module.exports = hashed;
