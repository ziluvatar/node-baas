[![Build Status](https://travis-ci.org/auth0/node-baas.svg?branch=master)](https://travis-ci.org/auth0/node-baas)

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

How it works?

The server listen in a TCP port. The protocol buffer is defined in `/protocol`.

The server start N workers by default N is the number of COREs on the system.

Every request (hash or compare) is assigned to a worker. A worker can handle one operation at the time. If all workers are "busy", the server will reply the request with "SERVER IS BUSY" error to the client. The client automatically retries the request in another connection.

## Client

Install:

```
npm i auth0/node-baas
```

The client keeps api-level compatibility with [node-bcrypt](https://github.com/ncb000gt/node.bcrypt.js/).

```javascript
var BaasClient = require('baas').Client;

var baas = new BaasClient({
  port: 9485,
  host: 'my-baas-load-balancer'
  pool: {
    maxConnections: 20,
    maxRequestsPerConnection: 10
  }
});

//hash a password
baas.hash('plainTextPassword', function (err, hash) {
  console.log(hash)
});

//compare a password
baas.compare('plainTextPassword', 'bcryptHash', function (err, success) {
  console.log(success)
});

```

The client also support ssl:

```javascript
var BaasClient = require('baas').Client;
var baas = new BaasClient({
  port: 9485,
  host: 'my-baas-load-balancer',
  protocol: 'baass'
  pool: {
    maxConnections: 20,
    maxRequestsPerConnection: 10
  }
});

//or
var baas = new BaasClient({
  uri: 'baass://my-baas-load-balancer',
  pool: {
    maxConnections: 20,
    maxRequestsPerConnection: 10
  }
});
```


## To install on ubuntu/debian

```
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv F63E3D3A
sudo sh -c 'echo deb http://debs.auth0.com/ stable main > /etc/apt/sources.list.d/auth0.list'
sudo aptitude update
sudo aptitude install -y baas
```

## Author

[Auth0](http://auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
