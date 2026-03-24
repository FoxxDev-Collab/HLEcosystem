#!/bin/sh
set -e

# Migrations are applied from host via `npx prisma migrate dev`
# The standalone output does not include prisma/ files

echo "Starting application..."
exec node server.js
