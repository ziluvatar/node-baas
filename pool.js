const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const BaaSClient   = require('./client');
const util         = require('util');
const retry        = require('retry');

function BaaSPool (options) {
  EventEmitter.call(this);

  this._connectionOptions = _.omit(options, ['pool']);

  this._options = _.extend({}, options.pool || {}, {
    maxConnections: 20,
    maxRequestsPerConnection: 10
  });

  this._openClients = 0;
  this._freeClients = [];
  this._queuedRequests = [];
}

util.inherits(BaaSPool, EventEmitter);

BaaSPool.prototype._getClient = function (callback) {
  const self = this;
  const freeClient = this._freeClients.pop();

  if (freeClient) {
    if (freeClient._requestCount < this._options.maxRequestsPerConnection) {
      return setImmediate(callback, null, freeClient);
    }

    self._openClients--;
    freeClient.disconnect();
  }

  if (self._openClients === self._options.maxConnections) {
    this._queuedRequests.push(callback);
    return;
  }

  //going to create a new client
  self._openClients++;
  const newClient = new BaaSClient(this._connectionOptions, function (err) {
    if (err) {
      return callback(err);
    }
    setImmediate(callback, null, newClient);
  });
};

BaaSPool.prototype._releaseClient = function (client) {
  const self = this;

  self._freeClients.push(client);

  var queued = self._queuedRequests.pop();

  if (queued) {
    self._getClient(queued);
  }
};

['compare', 'hash'].forEach(function (method) {
  BaaSPool.prototype[method] = function () {
    const operation = retry.operation({
      minTimeout: 200,
      maxTimeout: 800,
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
          if (client) {
            self._releaseClient(client);
          }
          originalCallback.apply(self, args);
        }

        if (operation.retry(err)) {
          self._releaseClient(client);
          return;
        }

        if (err) {
          return callback(err && operation.mainError());
        }


        args.push(callback);

        client[method].apply(client, args);
      });
    });
  };
});

module.exports = BaaSPool;