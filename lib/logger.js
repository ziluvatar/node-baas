var bunyan = require('bunyan');

module.exports = function (log_level) {
  return bunyan.createLogger({
    name:  'baas',
    level: log_level
  });
};