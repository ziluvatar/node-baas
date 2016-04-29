const ResponseMessage = require('../../messages').Response;
const encoder = require('pb-stream').encoder;

module.exports = function () {
  return encoder(ResponseMessage);
};
