const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const BaaSClient   = require('./client');
const util         = require('util');
const retry        = require('retry');

function BaaSPool (options) {
  EventEmitter.call(this);

  this._connectionOptions = _.omit(options, ['pool']);

  this._options = _.extend({
    maxConnections: 20,
    maxRequestsPerConnection: 10000
  }, options.pool || {});

  this._clients = [];
}

util.inherits(BaaSPool, EventEmitter);

BaaSPool.prototype._getClient = function (callback) {
  const self = this;

  self._clients
      .filter(c => c._requests >= self._options.maxRequestsPerConnection || (c.stream && !c.stream.writable))
      .forEach(c => self._killClient(c));

  if (self._clients.length < self._options.maxConnections) {
    const newClient = new BaaSClient(this._connectionOptions, function () {
      newClient._requests = 1;
      callback(null, newClient);
    });
    self._clients.push(newClient);
    return;
  }

  const client = self._clients.shift();
  client._requests++;
  self._clients.push(client);
  return setImmediate(callback, null, client);
};

BaaSPool.prototype._killClient = function (client) {
  const self = this;
  _.pull(self._clients, client);
  client.disconnect();
};

['compare', 'hash'].forEach(function (method) {
  BaaSPool.prototype[method] = function () {
    const operation = retry.operation({
      retries:    15,
      randomize:  false,
      minTimeout: 300,
      maxTimeout: 2000,
    });

    const args = Array.prototype.slice.call(arguments);
    const originalCallback = args.pop();
    const self = this;

    operation.attempt(function () {
      self._getClient(function (err, client) {
        function callback (err) {
          if (operation.retry(err)) {
            return;
          }
          const args = Array.prototype.slice.call(arguments);
          args[0] = err && operation.mainError();
          originalCallback.apply(self, args);
        }

        if (err) {
          return callback(err);
        }

        args.push(callback);

        client[method].apply(client, args);
      });
    });
  };
});

module.exports = BaaSPool;
