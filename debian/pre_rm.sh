#!/bin/bash

# prerm script for baas package

NAME="baas"

case "$1" in
  remove)
  echo "Removing $NAME"
  echo "Stopping service"
  service $NAME stop || true
  rm -f /etc/logrotate.d/$NAME-logs
  ;;
esac
