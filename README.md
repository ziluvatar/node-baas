[![Build Status](https://travis-ci.org/auth0/node-baas)](https://travis-ci.org/auth0/node-baas)

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
var BaasClient = require('baas').Client;
var baas = new BaasClient('server:9485');

//or use a pool of five connections
var BaasPool = require('baas').Pool;
var baas = new BaasPool({ port: 9485, size: 5 });

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