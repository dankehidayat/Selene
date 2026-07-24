FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/gps ./services/gps
RUN bun install --filter @selene/gps
WORKDIR /app/services/gps
EXPOSE 3008
CMD ["bun", "run", "src/index.ts"]
