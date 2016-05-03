const Response       = require('../../messages').Response;
const RequestMessage = require('../../messages').Request;
const bcrypt         = require('bcrypt');
const through2       = require('through2');

module.exports = function (options, socket, log) {
  const metrics = options.metrics;

  return through2.obj(function (message, enc, callback) {
    if (!(message instanceof RequestMessage)) {
      return callback(null, message);
    }

    if (message.operation !== RequestMessage.Operation.HASH) {
      return callback(null, message);
    }

    metrics.increment('requests.incoming.hash');

    log.debug({
      request: message.id,
      connection: socket._connection_id
    }, 'starting to hash password');

    var salt_length = parseInt(options.salt || 10, 10);

    var start = new Date();

    bcrypt.hash(message.password, salt_length, function (err, hash) {
      if (err) {
        return callback(err);
      }

      log.info({
        request:    message.id,
        connection: socket._connection_id,
        took:       new Date() - start,
      }, 'hash generated');

      var response = new Response({
        request_id: message.id,
        hash:       hash,
        success:    true
      });

      metrics.histogram('requests.processed.hash.time', (new Date() - start));
      metrics.increment('requests.processed.hash');

      callback(null, response);
    });

  });
};
