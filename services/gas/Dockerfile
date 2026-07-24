FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/gas ./services/gas
RUN bun install --filter @selene/gas
WORKDIR /app/services/gas
EXPOSE 3009
CMD ["bun", "run", "src/index.ts"]
