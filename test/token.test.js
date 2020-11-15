require("dotenv").config();
const assert = require("assert");
const jwt = require("jsonwebtoken");

describe("Token", function () {
  describe("#generator", function () {
    it("should generate a valid token", function () {
      const hashed = require("../cli/token");

      jwt.verify(
        Buffer.from(hashed, "base64").toString(),
        process.env.MARVELL_SECRET,
        {
          ignoreExpiration: false,
          maxAge: Number.parseInt(process.env.TOKEN_TIMEOUT),
        },
        function (err, decoded) {
          assert.strictEqual(err, null);
        }
      );
    });
  });
});
