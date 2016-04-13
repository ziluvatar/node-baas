const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const BaaSClient   = require('./client');
const util         = require('util');

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


  if (self._queuedRequests.length < 0) {
    return self._freeClients.push(client);
  }

  var queued = self._queuedRequests.pop();

  if (client._requestCount < self._options.maxRequestsPerConnection) {
    queued(null, client);
  } else {
    self._freeClients.push(client);
    self._getClient(queued);
  }

};

['compare', 'hash'].forEach(function (method) {
  BaaSPool.prototype[method] = function () {
    const args = Array.prototype.slice.call(arguments);
    const originalCallback = args.pop();
    const self = this;

    self._getClient(function (err, client) {
      if (err) {
        return originalCallback(err);
      }

      args.push(function () {
        self._releaseClient(client);
        originalCallback.apply(client, arguments);
      });

      client[method].apply(client, args);
    });
  };
});

module.exports = BaaSPool;