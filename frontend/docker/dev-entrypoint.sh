#!/bin/sh
set -eu

LOCKFILE_HASH_FILE="node_modules/.package-lock.hash"
CURRENT_HASH=""
STORED_HASH=""

CURRENT_HASH="$(sha256sum package.json | awk '{print $1}')"

if [ -f "$LOCKFILE_HASH_FILE" ]; then
  STORED_HASH="$(cat "$LOCKFILE_HASH_FILE")"
fi

if [ ! -d node_modules/next ] || [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  npm install

  printf '%s' "$CURRENT_HASH" > "$LOCKFILE_HASH_FILE"
fi

exec npm run dev
