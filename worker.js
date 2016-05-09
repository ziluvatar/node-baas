const bcrypt = require('bcrypt');

function compare (request, callback) {
  const success = bcrypt.compareSync(request.password, request.hash);
  const request_id = request.id;
  return callback(null, {
    request_id,
    success
  });
}

function hash (request, callback) {
  const hash = bcrypt.hashSync(request.password, 10);
  const request_id = request.id;
  return callback(null, {
    request_id,
    hash,
    success: true
  });
}

const worker = module.exports = function (request, callback) {
  if (request.operation === 0) {
    return compare(request, callback);
  } else if (request.operation === 1) {
    return hash(request, callback);
  }
};

/**
 * request { id, operation, password, hash? }
 * operation { compare: 0, hash: 1}
 */
process.on('message', (request) => {
  return worker(request, function (err, result) {
    process.send(result);
  });
});

