#!/bin/sh
set -eu

LOCKFILE_HASH_FILE="node_modules/.package-lock.hash"
MANIFEST_FILE="package.json"
CURRENT_HASH=""
STORED_HASH=""

if [ -f package-lock.json ]; then
  MANIFEST_FILE="package-lock.json"
  CURRENT_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
else
  CURRENT_HASH="$(sha256sum package.json | awk '{print $1}')"
fi

if [ -f "$LOCKFILE_HASH_FILE" ]; then
  STORED_HASH="$(cat "$LOCKFILE_HASH_FILE")"
fi

if [ ! -d node_modules/next ] || [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  if [ "$MANIFEST_FILE" = "package-lock.json" ]; then
    npm ci
  else
    npm install
  fi

  printf '%s' "$CURRENT_HASH" > "$LOCKFILE_HASH_FILE"
fi

exec npm run dev
