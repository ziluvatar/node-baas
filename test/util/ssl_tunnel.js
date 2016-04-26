const tls = require('tls');
const net = require('net');
const _ = require('lodash');

const selfsigned = require('selfsigned');
const attrs = [{ name: 'commonName', value: 'contoso.com' }];
const pems = selfsigned.generate(attrs, { days: 365 });

module.exports = function (port, target, callback) {
  const tunnel = tls.createServer({
    key: pems.private,
    cert: pems.cert,
  });

  tunnel.listen(port, function (err) {
    if (err) {
      return callback(err);
    }
    callback(null, { port });
  });

  tunnel.on('secureConnection', function (tlsSocket) {
    const backend = net.connect(target).on('error', _.noop);
    tlsSocket.pipe(backend).pipe(tlsSocket);
  });
};
