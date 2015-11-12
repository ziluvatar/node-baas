#!/bin/bash

# prerm script for node-baas package

NAME="node-baas"

service $NAME stop || true
rm -f /etc/logrotate.d/$NAME-logs
