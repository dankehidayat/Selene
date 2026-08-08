#!/bin/sh
set -e

echo "[entrypoint] syncing schema with PostgreSQL..."

# Navigate to monorepo root where node_modules exists
cd /app

# Run prisma from parent node_modules
bunx --cwd apps/backend prisma db push --schema=./apps/backend/prisma/schema.prisma

echo "[entrypoint] starting backend…"
exec bun run apps/backend/src/index.ts
