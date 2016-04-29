const through = require('through');
const Response = require('../../messages').Response;
const RequestMessage = require('../../messages').Request;
const bcrypt = require('bcrypt');


module.exports = function (options, socket, log) {
  const metrics = options.metrics;

  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.operation !== RequestMessage.Operation.HASH) {
      return stream.queue(message);
    }

    metrics.increment('requests.incoming.hash');

    log.debug({
      request: message.id,
      connection: socket._connection_id
    }, 'starting to hash password');

    var salt_length = parseInt(options.salt || 10, 10);

    var start = new Date();
    var hash = bcrypt.hashSync(message.password, salt_length);


    log.info({
      request: message.id,
      connection: socket._connection_id,
      took:       new Date() - start,
    }, 'hash generated');

    var response = new Response({
      request_id: message.id,
      hash:       hash,
      success:    true
    });

    metrics.increment('requests.processed.hash');

    stream.queue(response);
  });
};
