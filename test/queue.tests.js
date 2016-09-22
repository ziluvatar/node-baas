const BaaSServer = require('..').Server;
const freeport = require('freeport');
const assert = require('chai').assert;
const _ = require('lodash');
const BaaSClient = require('../client');
const bcrypt = require('bcrypt');


describe('client queue', function () {
  var directClient;
  var queueClient;
  var server;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }
      server = new BaaSServer({ port, logLevel: 'error', workers: 1 });

      server.start(function (err, address) {
        if (err) return done(err);
        directClient = new BaaSClient(_.extend({}, address, {  }), () => {
          queueClient = new BaaSClient(_.extend({}, address, { enqueueOnServer: true }), done);
        });
      });
    });
  });

  after(function () {
    server.stop();
  });

  afterEach(function () {
    if (Date.unfix) { Date.unfix(); }
  });

  it('should return server is busy on directClient', function (done) {
    var password = 'foobar';
    directClient.hash(password, _.noop);
    directClient.hash(password, function (err) {
      assert.equal(err.message, 'baas server is busy');
      done();
    });
  });

  it('should wait until a worker is free on queueClient', function (done) {
    var password = 'foobar';
    queueClient.hash(password, _.noop);
    queueClient.hash(password, function (err, hash) {
      if (err) { return done(err); }
      assert.ok(bcrypt.compareSync(password, hash));
      done();
    });
  });

});
