#!/bin/sh
set -e
cd /app/apps/backend

echo "[entrypoint] syncing schema with PostgreSQL..."
bunx prisma db push --schema=./prisma/schema.prisma

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
