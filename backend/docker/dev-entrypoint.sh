#!/bin/sh
set -e
set -u

LOCKFILE_HASH_FILE="node_modules/.package-lock.hash"
CURRENT_HASH="$(sha256sum package.json | awk '{print $1}')"
STORED_HASH=""

if [ -f "$LOCKFILE_HASH_FILE" ]; then
  STORED_HASH="$(cat "$LOCKFILE_HASH_FILE")"
fi

if [ ! -x node_modules/.bin/tsx ] || [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  npm install
  printf '%s' "$CURRENT_HASH" > "$LOCKFILE_HASH_FILE"
fi

npm run prisma:generate
exec npm run dev
