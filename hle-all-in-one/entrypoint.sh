#!/bin/sh
# Apply pending migrations, then serve. Migrations are transactional with
# checksum drift detection (src/server/migrate.ts) — a failed migration
# aborts startup rather than serving against a half-migrated schema.
set -e

echo "[entrypoint] running migrations"
bun scripts/migrate.ts

echo "[entrypoint] starting server on :${PORT:-3000}"
exec bun .output/server/index.mjs
