var through = require('through');
var Response = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;
var bcrypt = require('bcrypt');


module.exports = function (options, socket, log) {
  return through(function (message) {
    var stream = this;

    if (!(message instanceof RequestMessage)) {
      return stream.queue(message);
    }

    if (message.operation !== RequestMessage.Operation.COMPARE) {
      return stream.queue(message);
    }

    log.debug({
      request: message.id,
      connection: socket._connection_id
    }, 'comparing password');

    var start = new Date();

    bcrypt.compare(message.password, message.hash, function(err, success) {
      log.info({
        request:    message.id,
        connection: socket._connection_id,
        took:       new Date() - start,
        err:        err,
        result:     success
      }, 'password compared');

      var response = new Response({
        request_id: message.id,
        success:    success,
      });

      stream.queue(response);
    });

  });
};