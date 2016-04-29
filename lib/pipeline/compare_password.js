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

    if (message.operation !== RequestMessage.Operation.COMPARE) {
      return stream.queue(message);
    }

    metrics.increment('requests.incoming.compare');

    log.debug({
      request: message.id,
      connection: socket._connection_id
    }, 'comparing password');

    var start = new Date();
    var success = bcrypt.compareSync(message.password, message.hash);

    log.info({
      request:    message.id,
      connection: socket._connection_id,
      took:       new Date() - start,
      result:     success
    }, 'password compared');
    var response = new Response({
      request_id: message.id,
      success:    success,
    });

    metrics.histogram('requests.processed.compare.time', (new Date() - start));
    metrics.increment('requests.processed.compare');

    stream.queue(response);
  });
};
