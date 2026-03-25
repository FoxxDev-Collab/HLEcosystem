#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Ensuring upload directories..."
mkdir -p /app/uploads

echo "Starting application..."
exec node server.js
