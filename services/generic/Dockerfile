FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/generic ./services/generic
RUN bun install --filter @selene/generic
WORKDIR /app/services/generic
EXPOSE 3010
CMD ["bun", "run", "src/index.ts"]
