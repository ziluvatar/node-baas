#!/bin/bash

# prerm script for baas package

NAME="baas"

service $NAME stop || true
rm -f /etc/logrotate.d/$NAME-logs
