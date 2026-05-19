#!/bin/sh
set -eu

UPLOADS_DIR="${UPLOADS_DIR:-storage/uploads}"

prepare_dir() {
  target="$1"
  mkdir -p "$target"
  chown -R app:app "$target"
}

if [ -n "$UPLOADS_DIR" ]; then
  case "$UPLOADS_DIR" in
    /*)
      prepare_dir "$UPLOADS_DIR"
      ;;
    *)
      prepare_dir "/app/$UPLOADS_DIR"
      ;;
  esac
fi

prepare_dir /app/storage/uploads

exec su-exec app sh -c 'npm run prisma:deploy && node dist/server.js'
