FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/energy ./services/energy
RUN bun install --filter @selene/energy
WORKDIR /app/services/energy
EXPOSE 3002
CMD ["bun", "run", "src/index.ts"]
