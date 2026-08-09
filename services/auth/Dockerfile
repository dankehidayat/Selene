# Auth service — standalone with its own Prisma schema
# Build from monorepo root: docker compose -f docker-compose.modular.yml build auth

FROM oven/bun:1-alpine

WORKDIR /app

# Copy manifests first (layer cache)
COPY package.json bun.lock ./
COPY services/auth/package.json ./services/auth/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --filter @selene/auth --filter @selene/shared

# Copy source
COPY packages/shared ./packages/shared
COPY services/auth ./services/auth

WORKDIR /app/services/auth

# Generate Prisma client + push auth schema (own tables: RefreshSession, etc.)
CMD ["sh", "-c", "bunx prisma generate --schema=./prisma/schema.prisma && bunx prisma db push --schema=./prisma/schema.prisma --skip-generate || true; exec bun run src/index.ts"]
