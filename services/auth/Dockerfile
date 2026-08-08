FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/auth ./services/auth
RUN bun install --filter @selene/auth
RUN bunx prisma generate --schema=/app/services/auth/prisma/schema.prisma --no-hints
WORKDIR /app/services/auth
EXPOSE 3009
CMD ["bun", "run", "src/index.ts"]