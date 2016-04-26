const BaaSServer = require('..').Server;
const BaaSClient = require('..').Client;

const assert = require('chai').assert;
const bcrypt = require('bcrypt');
const ssl_tunnel = require('./util/ssl_tunnel');

var client;

describe('baas server (ssl)', function () {

  var server;

  before(function (done) {
    server = new BaaSServer({ port: 9001, logLevel: 'error' });

    server.start(function (err, address) {
      if (err) return done(err);
      ssl_tunnel(9002, address, function (err, address) {
        if (err) return done(err);
        client = new BaaSClient({port: address.port, protocol: 'baass', rejectUnauthorized: false});
        client.once('connect', done);
      });
    });
  });

  after(function () {
    server.stop();
  });

  afterEach(function () {
    if (Date.unfix) { Date.unfix(); }
  });

  it('should throw an error on invalid protocol', function () {
    assert.throws(function () {
      new BaaSClient({port: 900, protocol: 'baasxxxsa', rejectUnauthorized: false});
    }, /unknown protocol/);
  });

  it('should be able to hash a password', function (done) {
    var password = 'foobar';
    client.hash(password, function (err, response) {
      if (err) return done(err);
      assert.ok(bcrypt.compareSync(password, response.hash));
      done();
    });
  });

  it('should be able to compare a password and return ok', function (done) {
    var password = 'foobar';
    var hash = bcrypt.hashSync(password, 10);
    client.compare({
      password: password,
      hash: hash
    }, function (err, response) {
      if (err) return done(err);
      assert.ok(response.success);
      done();
    });
  });

});
