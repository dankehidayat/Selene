# Production backend — monorepo-aware (needs @selene/shared + @selene/sensors).
# Build from repository root:
#   docker compose -f docker-compose.production.yml build backend
#
# compose build.context must be the monorepo root (see docker-compose.production.yml).

FROM oven/bun:1-alpine

WORKDIR /app

# Install ALL workspace deps first (more reliable than filtered install)
COPY package.json bun.lock ./
RUN bun install

# Source code
COPY packages/shared ./packages/shared
COPY packages/sensors ./packages/sensors
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend
RUN bunx prisma generate || echo "Prisma generate skipped" || true

# Sync schema on container start (adds columns like passwordChangedAt)
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/docker-entrypoint.sh
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

EXPOSE 8787

# Production loads env from compose/env_file
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
