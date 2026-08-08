#!/bin/sh
set -e

echo "[entrypoint] syncing schema with PostgreSQL..."

# Run prisma db push using bunx (which resolves correctly in Bun context)
cd /app/apps/backend
bunx --cwd . prisma db push --schema=./prisma/schema.prisma || true

echo "[entrypoint] starting backend…"
exec bun run src/index.ts
