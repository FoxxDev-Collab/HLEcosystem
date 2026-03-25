#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Checking first-run seed..."
node prisma/seed-admin.js

echo "Starting application..."
exec node server.js
