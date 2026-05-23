#!/bin/sh
set -e

# Wait for PostgreSQL to accept connections before running migrations.
# Mirrors hle-file_server/entrypoint.sh; Bun supports `node:net`, so the
# probe is identical to the Next.js apps for parity.
echo "Waiting for PostgreSQL..."
MAX_ATTEMPTS=30
ATTEMPT=0
until bun -e "
  const url = new URL(process.env.DATABASE_URL);
  const net = require('net');
  const sock = net.connect({host: url.hostname, port: url.port || 5432}, () => { sock.end(); process.exit(0); });
  sock.on('error', () => process.exit(1));
" 2>/dev/null; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "PostgreSQL not reachable after ${MAX_ATTEMPTS}s — exiting."
    exit 1
  fi
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running database migrations..."
bun scripts/migrate.ts

echo "Starting application..."
exec bun src/index.ts
