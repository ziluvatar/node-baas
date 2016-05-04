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
    maxRequestsPerConnection: 100
  });

  this._openClients = 0;
  this._freeClients = [];
  this._queuedRequests = [];
}

util.inherits(BaaSPool, EventEmitter);

BaaSPool.prototype._getClient = function (callback) {
  const self = this;

  //realease death clients
  var clients_to_kill = this._freeClients.filter(function (client) {
    return !client.stream || !client.stream.writable;
  });

  clients_to_kill.forEach(function (client) {
    self._killClient(client);
  });
  ////

  const freeClient = this._freeClients.shift();

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

    // do nothing, the client will be reconnected eventually.
    newClient.on('error', _.noop);

    setImmediate(callback, null, newClient);
  });
};

BaaSPool.prototype._killClient = function (client) {
  const self = this;
  _.pull(self._freeClients, client);
  self._openClients--;
  client.disconnect();
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
          if (client) {
            if (err) {
              self._killClient(client);
            } else {
              self._releaseClient(client);
            }
          }
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
