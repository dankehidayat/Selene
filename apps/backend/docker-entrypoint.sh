#!/bin/sh
# Apply Prisma schema to Postgres before starting the API (Prisma 7 compatible)
set -e
cd /app/apps/backend

echo "[entrypoint] syncing schema with PostgreSQL..."
bunx prisma db push

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
