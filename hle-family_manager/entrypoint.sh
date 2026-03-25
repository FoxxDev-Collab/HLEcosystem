#!/bin/sh
set -e

# Wait for PostgreSQL to accept connections before running migrations.
# Parses DATABASE_URL to extract host and port, then polls with Node's net module.
echo "Waiting for PostgreSQL..."
MAX_ATTEMPTS=30
ATTEMPT=0
until node -e "
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
node node_modules/prisma/build/index.js migrate deploy

echo "Checking first-run seed..."
node prisma/seed-admin.js

echo "Starting application..."
exec node server.js
