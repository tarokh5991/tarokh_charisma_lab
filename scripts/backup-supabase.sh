#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL must be set}"

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  printf '%s\n' 'PostgreSQL client tools (pg_dump and pg_restore) are required.' >&2
  exit 1
fi

backup_dir="${BACKUP_DIR:-$PWD/backups/supabase}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$backup_dir/tarokh-$timestamp.dump"

umask 077
mkdir -p "$backup_dir"

pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file"

pg_restore --list "$backup_file" >/dev/null
sha256sum "$backup_file" >"$backup_file.sha256"
printf 'Backup verified: %s\n' "$backup_file"
