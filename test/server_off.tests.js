var BaaSClient = require('../client');
var assert = require('chai').assert;


describe('BaaSClient when server is off', function () {

  it('should return "socket is closed" error', function (done) {
    var client = new BaaSClient({
      host: '10.0.0.123'
    });

    client.hash('ip', function (err) {
      assert.equal(err.message, 'The socket is closed.');
      done();
    });
  });

});
