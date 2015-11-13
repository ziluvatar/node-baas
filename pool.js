var EventEmitter     = require('events').EventEmitter;
var async = require('async');
var BaaSClient = require('./client');
var _ = require('lodash');
var immediate = require('immediate');
var util = require('util');

function BaaSPool (options, done) {
  EventEmitter.call(this);

  var size = options.size || 5;
  var created = 0;
  var clients = this._clients = [];

  done = done || _.noop;

  this._current_client = 0;

  var pool = this;

  async.whilst(
    function () { return created < size; },
    function (done) {
      var client = new BaaSClient(options, function (err) {
        created++;

        if (err) {
          return done(err);
        }

        client.on('error', function (err) {
          pool.emit('error', err, client);
        });

        clients.push(client);
        done();
      });
    }, done);
}

util.inherits(BaaSPool, EventEmitter);

BaaSPool.prototype._getClient = function () {
  if (this._clients.length === 0) {
    return;
  }

  this._current_client++;

  if (this._current_client >= this._clients.length) {
    this._current_client = 0;
  }

  return this._clients[this._current_client];
};

BaaSPool.prototype.compare = function (options, callback) {
  var client = this._getClient();
  if (!client) {
    return immediate(callback, new Error('client not ready yet'));
  }
  client.compare.apply(client, arguments);
};

BaaSPool.prototype.hash = function (password, callback) {
  var client = this._getClient();
  if (!client) {
    return immediate(callback, new Error('client not ready yet'));
  }
  client.hash.apply(client, arguments);
};


module.exports = BaaSPool;