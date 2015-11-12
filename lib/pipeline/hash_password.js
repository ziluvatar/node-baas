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

    if (message.operation !== RequestMessage.Operation.HASH) {
      return stream.queue(message);
    }

    log.debug({
      request: message.id,
      connection: socket._connection_id
    }, 'starting to hash password');

    var salt_length = parseInt(options.salt || 10, 10);
    var start = new Date();

    bcrypt.genSalt(salt_length, function(err, salt) {

      log.debug({
        request: message.id,
        connection: socket._connection_id,
        took:    new Date() - start
      }, 'salt generated');

      bcrypt.hash(message.password, salt, function(err, hash) {

        log.info({
          request: message.id,
          connection: socket._connection_id,
          took:    new Date() - start
        }, 'hash generated');


        var response = new Response({
          request_id: message.id,
          hash:       hash,
          success:    true
        });

        stream.queue(response);
      });
    });

  });
};