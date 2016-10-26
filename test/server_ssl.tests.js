const BaaSServer = require('..').Server;
const BaaSClient = require('../client');

const assert = require('chai').assert;
const bcrypt = require('bcrypt');
const ssl_tunnel = require('./util/ssl_tunnel');
const freeport = require('freeport');


describe('baas server (ssl)', function () {
  var server, client;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }
      server = new BaaSServer({ port, logLevel: 'error' });
      server.start(function (err, address) {
        if (err) return done(err);
        ssl_tunnel(9002, address, function (err, address) {
          if (err) return done(err);
          client = new BaaSClient({port: address.port, protocol: 'baass', rejectUnauthorized: false});
          client.once('connect', done);
        });
      });
    });
  });

  after(function(done) {
    client.disconnect();
    server.stop(done);
  });

  it('should throw an error on invalid protocol', function () {
    assert.throws(function () {
      new BaaSClient({port: 900, protocol: 'baasxxxsa', rejectUnauthorized: false});
    }, /unknown protocol/);
  });

  it('should be able to hash a password', function (done) {
    var password = 'foobar';
    client.hash(password, function (err, hash) {
      if (err) return done(err);
      assert.ok(bcrypt.compareSync(password, hash));
      done();
    });
  });

  it('should be able to compare a password and return ok', function (done) {
    var password = 'foobar';
    var hash = bcrypt.hashSync(password, 10);
    client.compare(password, hash, function (err, success) {
      if (err) return done(err);
      assert.ok(success);
      done();
    });
  });

});
