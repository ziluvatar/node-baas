var tls = require('tls');

var socket = tls.connect({
  host: 'forum.it.auth0.com',
  port: 443
}, function () {
  console.dir(arguments);
});

socket.pipe(process.stdout);

socket.write('hello!!!!\n');
