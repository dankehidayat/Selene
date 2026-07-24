#!/bin/sh
# Apply Prisma schema to Postgres before starting the API.
# Safe for additive changes (passwordChangedAt, 2FA columns, etc.).
set -e
cd /app/apps/backend

echo "[entrypoint] prisma generate…"
bunx prisma generate

echo "[entrypoint] prisma db push (sync schema)…"
bunx prisma db push --skip-generate

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
