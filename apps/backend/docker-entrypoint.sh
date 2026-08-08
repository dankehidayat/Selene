#!/bin/sh
set -e

cd /app/apps/backend

echo "[entrypoint] syncing schema with PostgreSQL..."

# Use parent node_modules binary
../node_modules/.bin/prisma db push --schema=./prisma/schema.prisma || true

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
