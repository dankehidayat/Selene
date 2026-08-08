#!/bin/sh
set -e

echo "[entrypoint] syncing schema with PostgreSQL..."

# Run prisma from monorepo root node_modules
prisma_cmd="/app/node_modules/.bin/prisma"

"$prisma_cmd" db push \
  --schema="./apps/backend/prisma/schema.prisma" || true

echo "[entrypoint] starting backend…"
exec bun run apps/backend/src/index.ts
