# Production backend — monorepo-aware (needs @selene/shared + @selene/sensors).

FROM oven/bun:1-alpine

WORKDIR /app

# Copy manifests first (layer cache) — root + workspace package.json so
# bun resolves @selene/shared, @selene/sensors, prisma from the lockfile
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sensors/package.json ./packages/sensors/

RUN bun install --filter @selene/backend --filter @selene/shared --filter @selene/sensors

# Source code
COPY packages/shared ./packages/shared
COPY packages/sensors ./packages/sensors
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

# Generate Prisma client at build time (no DB needed — guarantees client exists)
RUN bunx prisma generate --schema=./prisma/schema.prisma

# Schema sync happens at runtime where DATABASE_URL exists; then start the app
CMD ["sh", "-c", "bunx prisma db push --schema=./prisma/schema.prisma --skip-generate || true; exec bun run src/index.ts"]
