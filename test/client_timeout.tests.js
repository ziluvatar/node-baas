const BaaSServer = require('..').Server;
const BaaSPool = require('../pool');
const freeport = require('freeport');
const assert = require('chai').assert;
const _ = require('lodash');

var client;

describe('client (timeout)', function () {

  var server;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }
      server = new BaaSServer({ port, logLevel: 'error', socketTimeout: 200 });

      server.start(function (err, address) {
        if (err) return done(err);
        client = new BaaSPool(_.extend({}, address, { pool: { maxConnections: 1 } }));
        done();
      });
    });
  });

  after(function () {
    server.stop();
  });

  afterEach(function () {
    if (Date.unfix) { Date.unfix(); }
  });

  it('should be able to hash a password', function (done) {
    var password = 'foobar';
    client.hash(password, function (err, hash) {
      if (err) return done(err);
      setTimeout(function () {
        assert.notOk(client._clients[0].socket.connected);
        client.compare(password, hash, function (err, result) {
          if (err) { return done(err); }
          assert.ok(result);
          done();
        });
      }, 600);
    });
  });

});
