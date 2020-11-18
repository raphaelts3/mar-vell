const assert = require("assert");
const jwt = require("jsonwebtoken");

describe("Token", function () {
  describe("#generator", function () {
    it("should generate a valid token", function (done) {
      process.env.MARVELL_SECRET = "secret";
      process.env.TOKEN_TIMEOUT = 60;
      const tokenService = require("../common/token");
      const token = tokenService.generate();
      tokenService.verify(token, function (err, decoded) {
        assert.strictEqual(err, null);
        done();
      });
    });
    it("token should be invalid", function (done) {
      process.env.MARVELL_SECRET = "secret";
      process.env.TOKEN_TIMEOUT = 60;
      const tokenService = require("../common/token");
      const token = tokenService.generate();
      process.env.MARVELL_SECRET = "not-secret";
      tokenService.verify(token, function (err, decoded) {
        assert.strictEqual(err.name, "JsonWebTokenError");
        done();
      });
    });
    it("token should be expired", function (done) {
      process.env.MARVELL_SECRET = "secret";
      process.env.TOKEN_TIMEOUT = 1;
      const tokenService = require("../common/token");
      const token = tokenService.generate();
      setTimeout(() => {
        tokenService.verify(token, function (err, decoded) {
          assert.strictEqual(err.name, "TokenExpiredError");
          done();
        });
      }, 1000);
    });
  });
});
