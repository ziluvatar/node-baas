var through = require('through');
var Response = require('../../messages').Response;
var RequestMessage = require('../../messages').Request;
var bcrypt = require('bcrypt');


module.exports = function (options, socket, log) {
  var address = { address: socket.remoteAddress, port: socket.remotePort };

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
      client: address
    }, 'comparing password');

    bcrypt.compare(message.password, message.hash, function(err, success) {
      var response = new Response({
        request_id: message.id,
        success:    success,
      });

      stream.queue(response);
    });

  });
};