FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/auth ./services/auth
RUN bun install --filter @selene/auth
WORKDIR /app/services/auth
EXPOSE 3009
CMD ["bun", "run", "src/index.ts"]
