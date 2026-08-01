#!/bin/sh
# Apply pending migrations, then serve. Migrations are transactional with
# checksum drift detection (src/server/migrate.ts) — a failed migration
# aborts startup rather than serving against a half-migrated schema.
set -e

echo "[entrypoint] running migrations"
bun scripts/migrate.ts

# Background scheduler (session pruning, recurring transactions, scheduled
# backups). Supervised: a crash restarts it after 30s without touching the
# web server; the subshell dies with the container.
echo "[entrypoint] starting scheduler"
(
  while true; do
    bun scripts/scheduler.ts
    echo "[entrypoint] scheduler exited; restarting in 30s"
    sleep 30
  done
) &

echo "[entrypoint] starting server on :${PORT:-3000}"
exec bun .output/server/index.mjs
