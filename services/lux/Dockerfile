FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/lux ./services/lux
RUN bun install --filter @selene/lux
WORKDIR /app/services/lux
EXPOSE 3007
CMD ["bun", "run", "src/index.ts"]
