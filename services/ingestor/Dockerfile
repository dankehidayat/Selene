FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/ingestor ./services/ingestor
RUN bun install --filter @selene/ingestor
WORKDIR /app/services/ingestor
EXPOSE 3005
CMD ["bun", "run", "src/index.ts"]
