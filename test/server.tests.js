const BaaSServer = require('..').Server;
const BaaSClient = require('../client');

const assert = require('chai').assert;
const bcrypt = require('bcrypt');
const freeport = require('freeport');

describe('baas server', function () {

  var server, client;

  before(function (done) {
    freeport(function (err, port) {
      if (err) { return done(err); }

      server = new BaaSServer({ port, logLevel: 'error' });

      server.start(function (err, address) {
        if (err) return done(err);
        client = new BaaSClient(address);
        client.once('connect', done).once('error', done);
      });
    });
  });

  after(function(done) {
    client.disconnect();
    server.stop(done);
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
