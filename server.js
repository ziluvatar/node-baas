const EventEmitter = require('events').EventEmitter;

const util   = require('util');
const logger = require('./lib/logger');
const _      = require('lodash');
const net = require('net');

const RequestDecoder = require('./messages/decoders').RequestDecoder;
const randomstring = require('randomstring');

const ResponseWriter = require('./lib/pipeline/response_writer');
const PasswordHasher = require('./lib/pipeline/hash_password');
const PasswordComparer = require('./lib/pipeline/compare_password');

const defaults = {
  port:      9485,
  hostname:  '0.0.0.0',
  logLevel: 'info',
  metrics: {
    gauge:     _.noop,
    increment: _.noop,
    histogram: _.noop,
    flush:     _.noop
  }
};

/*
 * Creates an instance of BaaSServer.
 *
 * Options:
 *
 *  - `port` the port to listen to. Defaults to 9231.
 *  - `hostname` the hostname to bind to. Defaults to INADDR_ANY
 *  - `logLevel` the verbosity of the logs. Defaults to 'info'.
 *
 */
function BaaSServer (options) {
  EventEmitter.call(this);
  const self = this;

  this._config = _.extend({}, defaults, options);
  this._logger = logger(this._config.logLevel);
  this._server = net.createServer(this._handler.bind(this));
  this._metrics = this._config.metrics;
  this._server.on('error', function (err) {
    self.emit('error', err);
  });
}

util.inherits(BaaSServer, EventEmitter);

BaaSServer.prototype._handler = function (socket) {
  const self = this;

  self._metrics.increment('connection.incoming');

  const sockets_details = _.pick(socket, ['remoteAddress', 'remotePort']);

  sockets_details.connection = socket._connection_id = randomstring.generate(5);

  const log = self._logger;

  socket.on('error', function (err) {
    self._metrics.increment('connection.error');
    log.info(_.extend(sockets_details, {
      err: {
        code:    err.code,
        message: err.message
      }
    }), 'connection error');
  }).on('close', function () {
    self._metrics.increment('connection.closed');
    log.debug(sockets_details, 'connection closed');
  });

  log.debug(sockets_details, 'connection accepted');

  const decoder = RequestDecoder();

  decoder.on('error', function () {
    log.info(sockets_details, 'unknown message format');
    return socket.end();
  });

  socket.pipe(decoder)
        .pipe(PasswordHasher(this._config, socket, log))
        .pipe(PasswordComparer(this._config, socket, log))
        .pipe(ResponseWriter())
        .pipe(socket);
};

BaaSServer.prototype.start = function (done) {
  const self = this;
  const log = self._logger;

  self._server.listen(this._config.port, this._config.hostname, function(err) {
    if (err) {
      log.error(err, 'error starting server');
      self.emit('error', err);
      if (done) {
        done(err);
      }
      return;
    }

    const address = self._server.address();

    log.info(address, 'server started');

    self.emit('started', address);
    if (done) {
      done(null, address);
    }
  });

  return this;
};

BaaSServer.prototype.stop = function () {
  const self = this;
  const log = self._logger;
  const address = self._server.address();

  this._server.close(function() {
    log.debug(address, 'server closed');
    self.emit('close');
  });
};


module.exports = BaaSServer;
