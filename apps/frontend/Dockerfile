# apps/frontend/Dockerfile
FROM oven/bun:1.2.12-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_BLYNK_SERVER_URL
ARG VITE_BLYNK_AUTH_TOKEN

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BLYNK_SERVER_URL=$VITE_BLYNK_SERVER_URL
ENV VITE_BLYNK_AUTH_TOKEN=$VITE_BLYNK_AUTH_TOKEN

RUN bun run build

FROM oven/bun:1.2.12-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/serve.ts ./serve.ts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "serve.ts"]