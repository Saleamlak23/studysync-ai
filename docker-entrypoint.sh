#!/bin/sh
set -e

# Run Prisma database migrations on startup if DATABASE_URL is available
if [ -n "$DATABASE_URL" ]; then
  echo "==> Running database migrations..."
  ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma || true
fi

# Execute the main container command (node apps/api/dist/server.js)
exec "$@"
