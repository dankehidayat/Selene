FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services/soil ./services/soil
RUN bun install --filter @selene/soil
WORKDIR /app/services/soil
EXPOSE 3006
CMD ["bun", "run", "src/index.ts"]
