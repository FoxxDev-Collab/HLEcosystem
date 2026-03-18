#!/bin/sh
set -e

echo "=== HLE File Server ==="

# Ensure upload directories exist and are writable
echo "Ensuring upload directories..."
mkdir -p /app/uploads

echo "Starting application..."
exec node server.js
