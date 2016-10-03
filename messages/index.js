const ProtoBuf = require('protobufjs');
const path = require('path');

const builder = ProtoBuf.loadProtoFile(path.join(__dirname, "/../protocol/Index.proto"));

module.exports = builder.build("baas");
