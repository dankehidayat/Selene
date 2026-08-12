# Local Development

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-12
**Status:** Published
**Type:** Guide
**Target Environment:** Local development workstation

---

## Overview

Run the Selene stack locally for development. Infrastructure (PostgreSQL, TimescaleDB, EMQX) runs in Docker; the backend and frontend run on Bun outside containers for fast iteration.

---

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Docker](https://www.docker.com/) with Compose plugin
- Git

---

## 1. Start infrastructure

```bash
git clone https://github.com/dankehidayat/selene.git
cd selene

docker compose -f docker-compose.local.yml up -d
```

| Service | Host port | Notes |
|---------|-----------|-------|
| PostgreSQL | **5434** | Avoids port conflict with local Postgres on 5432 |
| TimescaleDB | **5433** | Sensor readings hypertable |
| EMQX MQTT | **1883** | MQTT broker |
| EMQX dashboard | **18083** | Admin UI (admin / admin123) |

Postgres on port 5434 is deliberate — local system Postgres often owns port 5432. Keep `DATABASE_URL` pointed to 5434 to avoid Prisma P1010.

---

## 2. Start backend

```bash
cd apps/backend
cp .env.local.example .env
# Ensure DATABASE_URL → 127.0.0.1:5434
# Ensure TIMESCALE_URL → 127.0.0.1:5433

bun install
bun run db:generate
bun run db:migrate
bun run dev
```

Backend starts on port 8787. API docs at `http://localhost:8787/docs`.

---

## 3. Start frontend

```bash
cd apps/frontend
cp .env.local.example .env
bun install
bun run dev
```

Frontend starts on port 5173 (Vite dev server).

---

## 4. Live ESP32 data (optional)

Forward production MQTT traffic to your local backend:

```bash
./scripts/mqtt-tunnel.sh
# Forwards 127.0.0.1:1884 → production server EMQX :1883
```

Then in `apps/backend/.env` set `MQTT_HOST=127.0.0.1`, `MQTT_PORT=1884`. Start the backend and watch for `[MQTT] Connected` in logs.

---

## Environment files

When developing locally, the following env-file copies are needed:

| Copy this | To this | Purpose |
|-----------|---------|---------|
| `apps/backend/.env.local.example` | `apps/backend/.env` | Local backend (ports 5434, 5433) |
| `apps/frontend/.env.local.example` | `apps/frontend/.env` | Local frontend (`VITE_API_BASE_URL=/api`) |

The root `.env` is only used for Docker Compose variable substitution and is not needed for local development.

---

## Available services (for local testing)

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8787 |
| Swagger docs | http://localhost:8787/docs |
| Frontend | http://localhost:5173 |
| EMQX Dashboard | http://localhost:18083 (admin / admin123) |
| PostgreSQL | localhost:5434 (selene_admin / password from compose file) |
| TimescaleDB | localhost:5433 (selene_ts / password from compose file) |

---

## Commands reference

```bash
bun install                 # Install all workspace dependencies
bun run dev:backend         # Start backend in watch mode
bun run dev:ingestor        # Start standalone ingestor
bun run test:sensors        # Run sensor parser tests
bun run typecheck           # TypeScript type check (workspace-wide)
```

---

## Port conflict resolution

If port 5434 or 5433 is already in use, stop the conflicting service or change the host port in `docker-compose.local.yml` and update the env files accordingly.

If port 1883 is taken by another MQTT broker, stop it first: `brew services stop mosquitto` (Homebrew) or `sudo systemctl stop mosquitto` (system-level).