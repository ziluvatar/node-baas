var ResponseMessage = require('../../messages').Response;
var encoder = require('pb-stream').encoder;

module.exports = function (metrics) {
  if (metrics) {
    metrics.increment('requests.processed');
  }
  return encoder(ResponseMessage);
};