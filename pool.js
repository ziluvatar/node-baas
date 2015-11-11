var async = require('async');
var BaaSClient = require('./client');

function BaaSPool (options, done) {
  var size = options.size || 5;
  var created = 0;
  var clients = this._clients = [];

  async.whilst(
    function () { return created < size; },
    function (done) {
      clients.push(new BaaSClient(options, done));
      created++;
    }, done);
}

BaaSPool.prototype.compare = function () {
  var client = this._clients.shift();
  client.compare.apply(client, arguments);
  this._clients.push(client);
};

BaaSPool.prototype.hash = function () {
  var client = this._clients.shift();
  client.hash.apply(client, arguments);
  this._clients.push(client);
};


module.exports = BaaSPool;