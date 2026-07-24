# Production backend — monorepo-aware (needs @selene/shared + @selene/sensors).
# Build from repository root:
#   docker compose -f docker-compose.production.yml build backend
#
# compose build.context must be the monorepo root (see docker-compose.production.yml).

FROM oven/bun:1-alpine

WORKDIR /app

# Workspace root lockfile + package manifests
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sensors/package.json ./packages/sensors/

# Install workspace deps (backend + packages only)
RUN bun install --filter @selene/backend --filter @selene/shared --filter @selene/sensors

# Source
COPY packages/shared ./packages/shared
COPY packages/sensors ./packages/sensors
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend
RUN bunx prisma generate

EXPOSE 8787

# Production should load env from compose/env_file, not .env.local
CMD ["bun", "run", "src/index.ts"]
