const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const BaaSClient   = require('./client');
const util         = require('util');

function BaaSPool (options) {
  EventEmitter.call(this);

  this._connectionOptions = _.omit(options, ['pool']);

  this._options = _.extend({}, options.pool || {}, {
    maxConnections: 100,
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
    } else {
      self._openClients--;
      freeClient.disconnect();
    }
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
  if (self._queuedRequests.length > 0) {
    return self._queuedRequests.pop()(client);
  }
  self._freeClients.push(client);
};

['compare', 'hash'].forEach(function (method) {
  BaaSPool.prototype[method] = function (options, callback) {
    const args = Array.prototype.slice.call(arguments);
    const originalCallback = args.pop();
    const self = this;

    self._getClient(function (err, client) {
      if (err) {
        return callback(err);
      }

      args.push(function () {
        self._releaseClient(client);
        originalCallback.apply(null, arguments);
      });

      client[method].apply(client, args);
    });
  };
});

module.exports = BaaSPool;