const cluster = require('cluster');

const EventEmitter = require('events').EventEmitter;

const util   = require('util');
const logger = require('./lib/logger');
const _      = require('lodash');
const net = require('net');

const RequestDecoder = require('./messages/decoders').RequestDecoder;
const randomstring = require('randomstring');

const ResponseWriter = require('./lib/pipeline/response_writer');
const through2 = require('through2');
const Response       = require('./messages').Response;


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

function fork_worker() {
  const worker = cluster.fork();

  worker._pendingRequests = new Map();

  worker.on('message', function (response) {
    var callback = worker._pendingRequests.get(response.request_id);
    worker._pendingRequests.delete(response.id);
    return callback(null, response);
  });

  worker.sendRequest = function (message, callback) {
    worker._pendingRequests.set(message.id, callback);
    worker.send(message);
  };

  return worker;
}

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


  cluster.setupMaster({
    exec: __dirname + '/worker.js'
  });

  const workers_number = typeof process.env.WORKERS === 'undefined' ||
                          process.env.WORKERS === 'AUTO' ?
                          Math.max(require('os').cpus().length - 1, 1) :
                          parseInt(process.env.WORKERS);

  this._workers = _.range(workers_number).map(fork_worker);


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
        .pipe(through2.obj((request, encoding, callback) => {
          const worker = self._workers.shift();
          const operation = request.operation === 0 ? 'compare' : 'hash';
          const start = new Date();

          if (!worker) {
            log.info({
              request:    request.id,
              connection: socket._connection_id,
              took:       new Date() - start,
              worker:     worker.id,
              operation:  operation
            }, `${operation} not done - server is busy`);

            return  callback(null, new Response({
              request_id: request.id,
              success:    false,
              busy:       true
            }));
          }

          self._metrics.histogram(`requests.incoming.${operation}.time`, (new Date() - start));

          worker.sendRequest(request, (err, response) => {
            log.info({
              request:    request.id,
              connection: socket._connection_id,
              took:       new Date() - start,
              worker:     worker.id,
              operation:  operation
            }, `${operation} completed`);

            self._metrics.histogram(`requests.processed.${operation}.time`, (new Date() - start));
            self._metrics.increment(`requests.processed.${operation}`);
            self._workers.push(worker);
            callback(null, new Response(response));
          });

        }))
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
