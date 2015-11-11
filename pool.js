var async = require('async');
var BaaSClient = require('./client');

function BaaSPool (options, done) {
  var size = options.size || 5;
  var created = 0;
  var clients = this._clients = [];

  this._current_client = 0;

  async.whilst(
    function () { return created < size; },
    function (done) {
      clients.push(new BaaSClient(options, done));
      created++;
    }, done);
}

BaaSPool.prototype._getClient = function () {
  this._current_client++;

  if (this._current_client >= this._clients.length) {
    this._current_client = 0;
  }

  return this._clients[this._current_client];
};

BaaSPool.prototype.compare = function () {
  var client = this._getClient();
  client.compare.apply(client, arguments);
};

BaaSPool.prototype.hash = function () {
  var client = this._getClient();
  client.hash.apply(client, arguments);
};


module.exports = BaaSPool;