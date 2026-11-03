#!/usr/bin/env bash
set -euo pipefail

# Restore drill. Point DATABASE_URL at a scratch database, never production.
#   ./scripts/restore.sh backups/atlas-20261023T020000Z.dump

FILE="${1:?usage: restore.sh <backup.dump>}"
: "${DATABASE_URL:?DATABASE_URL is required}"

echo "[restore] verifying archive"
pg_restore --list "${FILE}" >/dev/null

echo "[restore] restoring into ${DATABASE_URL}"
pg_restore "${DATABASE_URL}" \
  --clean --if-exists --no-owner --no-acl --single-transaction "${FILE}"

echo "[restore] running sanity query"
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS tenants FROM tenants;'
echo "[restore] complete"
