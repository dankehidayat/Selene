FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/firmware ./services/firmware
RUN bun install --filter @selene/firmware
WORKDIR /app/services/firmware
EXPOSE 3004
CMD ["bun", "run", "src/index.ts"]
