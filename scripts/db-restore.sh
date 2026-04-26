#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

if [ "$#" -ne 1 ]; then
  printf 'Uso: %s caminho/do/backup.dump\n' "$0" >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$1"
