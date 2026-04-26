#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:=./backups}"
: "${BACKUP_RETENTION_DAYS:=7}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/selecao-posgrad-$timestamp.dump"

pg_dump "$DATABASE_URL" -Fc -f "$target"
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -delete

printf '%s\n' "$target"
