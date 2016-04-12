var EventEmitter     = require('events').EventEmitter;
var util             = require('util');
var randomstring     = require('randomstring');
var reconnect        = require('reconnect-net');
var RequestMessage   = require('./messages').Request;
var ResponseDecoder  = require('./messages/decoders').ResponseDecoder;
var url              = require('url');
var _                = require('lodash');
var immediate        = require('immediate');

var cb = require('cb');

var DEFAULT_PORT = 9485;
var DEFAULT_HOST = 'localhost';

function BaaSClient (options, done) {
  options = options || {};
  EventEmitter.call(this);
  if (typeof options === 'string') {
    options = _.pick(url.parse(options), ['port', 'hostname']);
    options.port = parseInt(options.port || DEFAULT_PORT, 10);
  } else {
    options.port = options.port || DEFAULT_PORT;
    options.host = options.host || DEFAULT_HOST;
  }
  this._options = options;
  this.connect(done);
  this._requestCount = 0;
}

util.inherits(BaaSClient, EventEmitter);

BaaSClient.prototype.connect = function (done) {
  var options = this._options;
  var client = this;

  this.socket = reconnect(function (stream) {

    stream.pipe(ResponseDecoder()).on('data', function (response) {
      client.emit('response', response);
      client.emit('response_' + response.request_id, response);
    });

    client.stream = stream;
    client.emit('ready');
  }).once('connect', function () {
    client.emit('connect');
    if (done) {
      done();
    }
  }).on('close', function (has_error) {
    client.emit('close', has_error);
  }).on('error', function (err) {
    client.emit('error', err);
  }).connect(options.port, options.address || options.hostname || options.host);
};

BaaSClient.prototype.hash = function (password, callback) {
  if (!password) {
    return immediate(callback, new Error('password is required'));
  }

  if (!callback) {
    return immediate(callback, new Error('callback is required'));
  }

  if (!this.stream || !this.stream.writable) {
    return immediate(callback, new Error('The socket is closed.'));
  }

  this._requestCount++;

  callback = cb(callback).timeout(10000);

  var request = new RequestMessage({
    'id':        randomstring.generate(7),
    'password':  password,
    'operation': RequestMessage.Operation.HASH,
  });

  this.stream.write(request.encodeDelimited().toBuffer());

  this.once('response_' + request.id, function (response) {
    callback(null, { hash: response.hash });
  });
};

BaaSClient.prototype.compare = function (params, callback) {
  if (!params.password) {
    return immediate(callback, new Error('password is required'));
  }

  if (!params.hash) {
    return immediate(callback, new Error('hash is required'));
  }

  if (!callback) {
    return immediate(callback, new Error('callback is required'));
  }

  if (!this.stream || !this.stream.writable) {
    return immediate(callback, new Error('The socket is closed.'));
  }

  this._requestCount++;

  callback = cb(callback).timeout(10000);

  var request = new RequestMessage({
    'id':        randomstring.generate(7),
    'password':  params.password,
    'hash':      params.hash,
    'operation': RequestMessage.Operation.COMPARE,
  });

  this.stream.write(request.encodeDelimited().toBuffer());

  this.once('response_' + request.id, function (response) {
    callback(null, { success: response.success });
  });
};

BaaSClient.prototype.disconnect = function () {
  this.socket.disconnect();
};

module.exports = BaaSClient;