# Production backend — monorepo-aware (needs @selene/shared + @selene/sensors).

FROM oven/bun:1-alpine

WORKDIR /app

# Install ALL workspace deps first
COPY package.json bun.lock ./
RUN bun install

# Source code
COPY packages/shared ./packages/shared
COPY packages/sensors ./packages/sensors
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

# Run prisma db push at build time (one-time schema sync)
RUN bunx --schema=./prisma/schema.prisma prisma db push || true

# Entrypoint just starts the app
CMD ["bun", "run", "src/index.ts"]
