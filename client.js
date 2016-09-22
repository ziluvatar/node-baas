const EventEmitter     = require('events').EventEmitter;
const util             = require('util');
const randomstring     = require('randomstring');
const reconnect        = require('reconnect-net');
const RequestMessage   = require('./messages').Request;
const ResponseDecoder  = require('./messages/decoders').ResponseDecoder;
const url              = require('url');
const reconnectTls     = require('reconnect-tls');

const cb = require('cb');
const ms = require('ms');
const _  = require('lodash');

const DEFAULT_PROTOCOL = 'baas';
const DEFAULT_PORT  = 9485;
const DEFAULT_HOST  = 'localhost';

const lib_map = {
  'baas': reconnect,
  'baass': reconnectTls
};

function parseURI (uri) {
  var parsed = url.parse(uri);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || DEFAULT_PORT, 10),
    protocol: parsed.protocol.slice(0, -1)
  };
}

function BaaSClient (options, done) {
  options = options || {};
  EventEmitter.call(this);

  if (typeof options === 'string') {
    options = parseURI(options);
  } else if (options.uri || options.url) {
    options = _.extend(options, parseURI(options.uri || options.url));
  } else {
    options.protocol = options.protocol || DEFAULT_PROTOCOL;
    options.port = options.port || DEFAULT_PORT;
    options.host = options.host || DEFAULT_HOST;
  }

  this._socketLib = lib_map[options.protocol];

  if (!this._socketLib) {
    throw new Error('unknown protocol ' + options.protocol);
  }

  this._options = options;
  this._requestCount = 0;

  if (typeof this._options.requestTimeout === 'undefined') {
    this._options.requestTimeout = ms('2s');
  }

  this._pendingRequests = 0;
  this.connect(done);
}

util.inherits(BaaSClient, EventEmitter);

BaaSClient.prototype.connect = function (done) {
  var options = this._options;
  var client = this;

  this.socket = this._socketLib(function (stream) {

    stream.pipe(ResponseDecoder()).on('data', function (response) {
      client.emit('response', response);
      client.emit('response_' + response.request_id, response);
    });

    client.stream = stream;
    client.emit('ready');
  }).once('connect', function () {
    client.emit('connect');
  }).on('close', function (has_error) {
    client.emit('close', has_error);
  }).on('error', function (err) {
    if (err === 'DEPTH_ZERO_SELF_SIGNED_CERT' && options.rejectUnauthorized === false) {
      return;
    }
    client.emit('error', err);
  }).connect(options.port, options.address || options.hostname || options.host, {
    rejectUnauthorized: options.rejectUnauthorized
  });

  client.once('ready', done || _.noop);
};

BaaSClient.prototype.hash = function (password, salt, callback) {
  //Salt is keep for api-level compatibility with node-bcrypt
  //but is enforced in the backend.
  if (typeof salt === 'function') {
    callback = salt;
  }

  if (!password) {
    return setImmediate(callback, new Error('password is required'));
  }

  const request = {
    'password':  password,
    'operation': RequestMessage.Operation.HASH,
  };

  this._sendRequest(request, (err, response) => {
    callback(err, response && response.hash);
  });
};

BaaSClient.prototype.compare = function (password, hash, callback) {
  if (!password) {
    return setImmediate(callback, new Error('password is required'));
  }

  if (!hash) {
    return setImmediate(callback, new Error('hash is required'));
  }

  var request = {
    'password':  password,
    'hash':      hash,
    'operation': RequestMessage.Operation.COMPARE,
  };

  this._sendRequest(request, (err, response) => {
    callback(err, response && response.success);
  });
};

BaaSClient.prototype._sendRequest = function (params, callback) {
  if (!callback) {
    return setImmediate(callback, new Error('callback is required'));
  }

  if (!this.stream || !this.stream.writable) {
    return setImmediate(callback, new Error('The socket is closed.'));
  }

  const request = new RequestMessage(_.extend({
    'id': randomstring.generate(7),
    'enqueue': !!this._options.enqueueOnServer
  }, params));
  // console.dir(request);
  this._requestCount++;
  this._pendingRequests++;

  callback = cb(callback).timeout(this._options.requestTimeout);

  this.stream.write(request.encodeDelimited().toBuffer());

  this.once('response_' + request.id, (response) => {
    this._pendingRequests--;
    if (this._pendingRequests === 0) {
      this.emit('drain');
    }

    if (response.busy) {
      return callback(new Error('baas server is busy'));
    }

    callback(null, response);
  });
};

BaaSClient.prototype.disconnect = function () {
  this.socket.disconnect();
};

module.exports = BaaSClient;
