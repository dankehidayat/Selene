FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/climate ./services/climate
RUN bun install --filter @selene/climate
WORKDIR /app/services/climate
EXPOSE 3003
CMD ["bun", "run", "src/index.ts"]
