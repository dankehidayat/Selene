# apps/frontend/Dockerfile
FROM oven/bun:1-alpine AS builder

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

FROM alpine:latest
COPY --from=builder /app/dist /srv
EXPOSE 80
CMD ["sh", "-c", "tail -f /dev/null"]