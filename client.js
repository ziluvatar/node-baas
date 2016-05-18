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

BaaSClient.prototype.hash = function (password, callback) {
  const self = this;

  if (!password) {
    return setImmediate(callback, new Error('password is required'));
  }

  if (!callback) {
    return setImmediate(callback, new Error('callback is required'));
  }

  if (!self.stream || !self.stream.writable) {
    return setImmediate(callback, new Error('The socket is closed.'));
  }

  self._requestCount++;

  callback = cb(callback).timeout(self._options.requestTimeout);

  var request = new RequestMessage({
    'id':        randomstring.generate(7),
    'password':  password,
    'operation': RequestMessage.Operation.HASH,
  });

  self._pendingRequests++;
  self.stream.write(request.encodeDelimited().toBuffer());

  self.once('response_' + request.id, function (response) {
    self._pendingRequests--;
    if (self._pendingRequests === 0) {
      self.emit('drain');
    }
    if (response.busy) {
      return callback(new Error('baas server is busy'));
    }
    callback(null, { hash: response.hash });
  });
};

BaaSClient.prototype.compare = function (params, callback) {
  const self = this;

  if (!params.password) {
    return setImmediate(callback, new Error('password is required'));
  }

  if (!params.hash) {
    return setImmediate(callback, new Error('hash is required'));
  }

  if (!callback) {
    return setImmediate(callback, new Error('callback is required'));
  }

  if (!this.stream || !this.stream.writable) {
    return setImmediate(callback, new Error('The socket is closed.'));
  }

  this._requestCount++;

  callback = cb(callback).timeout(this._options.requestTimeout);

  var request = new RequestMessage({
    'id':        randomstring.generate(7),
    'password':  params.password,
    'hash':      params.hash,
    'operation': RequestMessage.Operation.COMPARE,
  });

  self._pendingRequests++;
  self.stream.write(request.encodeDelimited().toBuffer());

  self.once('response_' + request.id, function (response) {
    self._pendingRequests--;
    if (self._pendingRequests === 0) {
      self.emit('drain');
    }

    if (response.busy) {
      return callback(new Error('baas server is busy'));
    }
    callback(null, { success: response.success });
  });
};

BaaSClient.prototype.disconnect = function () {
  this.socket.disconnect();
};

module.exports = BaaSClient;
