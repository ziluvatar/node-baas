'use strict';
const BaaSServer = require('..').Server;
const BaaSPool = require('../pool');
const freeport = require('freeport');
const assert = require('chai').assert;
const bcrypt = require('bcrypt');

describe('pool client', function () {
  let client;
  let server;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }
      server = new BaaSServer({ port, logLevel: 'error' });

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
    client.hash(password, function (err, hash) {
      if (err) return done(err);
      assert.ok(bcrypt.compareSync(password, hash));
      done();
    });
  });

  it('should be able to subscribe to events', function () {
    assert.ok(client.on);
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
