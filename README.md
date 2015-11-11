[![Build Status](https://travis-ci.org/auth0/limitd.svg)](https://travis-ci.org/auth0/node-baas)

Bcrypt as a service (node.js)


This module is a client and server.

## Server

Installation:

```
sudo npm i -g auth0/node-baas
```

Start a baas server on port 9485 and salt with 10 iterations:

```
baas -p 9485 -s 10
```

## Client

Install:

```
npm i auth0/node-baas
```

Usage

```javascript
var BaasClient = require('baas');
var baas = new BaasClient('server:9485');

//hash a password
baas.hash('mypassword', function (err, result) {
  console.log(result.hash)
});

//compare a password
baas.compare({hash: 'the bcrypt hash', password: 'mypassword'}, function (err, result) {
  console.log(result.success)
});

```

## License

MIT 2015 - AUTH0 INC.