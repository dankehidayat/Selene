# apps/backend/Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . .
RUN bun run db:generate

EXPOSE 8787

CMD ["bun", "run", "src/index.ts"]