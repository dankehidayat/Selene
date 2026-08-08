#!/bin/sh
set -e
cd /app/apps/backend

echo "[entrypoint] syncing schema with PostgreSQL..."
# Use bundled Prisma v6 binary (not bunx which resolves to latest)
./node_modules/.bin/prisma db push --schema=./prisma/schema.prisma

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
