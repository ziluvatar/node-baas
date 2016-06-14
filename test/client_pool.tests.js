const BaaSServer = require('..').Server;
const BaaSPool = require('..').Pool;
const freeport = require('freeport');
const assert = require('chai').assert;
const bcrypt = require('bcrypt');

var client;

describe('pool client', function () {

  var server;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }
      server = new BaaSServer({ port, logLevel: 'error'});

      server.start(function (err, address) {
        if (err) return done(err);
        client = new BaaSPool(address);
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
    client.hash(password, function (err, response) {
      if (err) return done(err);
      assert.ok(bcrypt.compareSync(password, response.hash));
      done();
    });
  });

  it('should be able to subscribe to events', function () {
    assert.ok(client.on);
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
