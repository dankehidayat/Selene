FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/analytics ./services/analytics
RUN bun install --filter @selene/analytics
WORKDIR /app/services/analytics
EXPOSE 3006
CMD ["bun", "run", "src/index.ts"]