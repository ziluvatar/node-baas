const EventEmitter     = require('events').EventEmitter;
const util             = require('util');
const randomstring     = require('randomstring');
const reconnect        = require('reconnect-net');
const RequestMessage   = require('./messages').Request;
const ResponseDecoder  = require('./messages/decoders').ResponseDecoder;
const url              = require('url');
const immediate        = require('immediate');
const reconnectTls     = require('reconnect-tls');

const cb = require('cb');
const ms = require('ms');

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
    options = parseURI(options.uri || options.url);
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
    if (done) {
      done();
    }
  }).on('close', function (has_error) {
    client.emit('close', has_error);
  }).on('error', function (err) {
    client.emit('error', err);
  }).connect(options.port, options.address || options.hostname || options.host, {
    rejectUnauthorized: options.rejectUnauthorized
  });
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

  callback = cb(callback).timeout(this._options.requestTimeout);

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

  callback = cb(callback).timeout(this._options.requestTimeout);

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
