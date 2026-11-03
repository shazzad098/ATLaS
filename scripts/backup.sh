#!/usr/bin/env bash
set -euo pipefail

# Nightly logical backup. Run from cron/systemd on the database host or a
# worker with DATABASE_URL set. Uses pg_dump's custom format (compressed,
# restorable with pg_restore) and prunes old files.

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/atlas-${STAMP}.dump"

: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p "${BACKUP_DIR}"

echo "[backup] starting ${FILE}"
pg_dump "${DATABASE_URL}" --format=custom --no-owner --no-acl --file="${FILE}"

# Verify the archive header before declaring success.
pg_restore --list "${FILE}" >/dev/null
echo "[backup] archive verified"

find "${BACKUP_DIR}" -type f -name 'atlas-*.dump' -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] done; retention ${RETENTION_DAYS} days"
