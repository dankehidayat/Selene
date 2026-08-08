# Selene

Real-time smart energy & climate monitoring for IoT sensor fleets. ESP32-based sensors stream telemetry over MQTT; Selene ingests, stores, and visualizes time-series data with statistical and fuzzy-logic analytics — served by a Fastify monolith with an optional path toward domain-split microservices.

[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black)](https://bun.sh)

## Highlights

- **Live dashboard** — energy (voltage, current, power, power factor, frequency) and climate (temperature, humidity) with a real-time SSE stream.
- **TimescaleDB ingestion** — raw SQL ingest + analytic queries against the `sensor_readings` hypertable.
- **Fuzzy analytics** — 15-rule energy + 14-rule climate Mamdani inference engines, Bland-Altman, box plots, decision surfaces.
- **Client-side ML forecasting** — linear regression + exponential smoothing + hourly pattern-matching ensemble.
- **Auth & RBAC** — JWT sessions, roles (User/Admin), 2FA (TOTP), password reset, login history, notifications.
- **OTA firmware management** — upload and track ESP32 OTA firmware.
- **Extensible microservices** — parser-registry architecture that lets new sensor domains (soil, lux, …) be added without touching existing services.

## Architecture

```
ESP32 (PZEM-004T + DHT11)
        │  MQTT (EMQX)
        ▼
  Ingestor / Monolith MQTT client
        │  parser registry (energy + climate)
        ▼
  TimescaleDB  ──────────▶  PostgreSQL (users / auth / settings)
        │                        │
        └─────── Fastify API ─────┘
                    │
              React SPA
```

- The **monolith** (`apps/backend`, port 8787) is the primary production API and MQTT ingestor. The frontend talks to `/api/*` on it.
- A **microservices variant** (`services/`, via `docker-compose.modular.yml`) splits domains behind a Caddy gateway. Scaffolded and partially implemented (energy + climate now query real TimescaleDB) but **not yet the production deployment**.
- Postgres is now **deprecated as the storage for telemetry**; all sensor readings live in TimescaleDB.

---

## Repository layout

```
apps/
  backend/    Fastify API monolith (auth, analytics, readings, MQTT ingest, OTA)
  frontend/   React SPA dashboard (Vite + TanStack Router/Query + Tailwind)
packages/
  shared/     Shared TypeScript types, Timescale helper, MQTT client, JWT helpers
  sensors/    PZEM-004T + DHT11 sensor modules + MQTT parser registry
services/
  ingestor/   Standalone MQTT → parser-registry → TimescaleDB process
  auth/       (microservice) users · JWT · roles
  energy/     (microservice) energy analytics (real TimescaleDB queries)
  climate/    (microservice) climate analytics (real TimescaleDB queries)
  firmware/   (microservice) OTA upload + MQTT commands
  soil/ lux/ gas/ gps/ generic/   extension stubs (scaffolded)
deploy/
  Caddyfile.modular             Caddy gateway for the microservices variant
docker-compose.yml              production VPS stack (postgres + timescale + emqx + backend + frontend)
docker-compose.local.yml        local-dev infra only (postgres:5434 · timescale:5433 · emqx:1883)
docker-compose.modular.yml      microservices stack (not for VPS yet)
scripts/
  mqtt-tunnel.sh               forward local 1884 → VPS EMQX 1883 (live-dev data)
docs/                          architecture, deployment, and extension docs
```

---

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- [Docker](https://www.docker.com/) with Compose (PostgreSQL, TimescaleDB, EMQX)

## Quick start (local development)

```bash
git clone https://github.com/dankehidayat/selene.git
cd selene

# 1. Infra: Postgres + TimescaleDB + EMQX
docker compose -f docker-compose.local.yml up -d

# 2. Backend (port 8787)
cd apps/backend
cp .env.local.example .env
# DATABASE_URL → 127.0.0.1:5434   TIMESCALE_URL → 127.0.0.1:5433
bun install
bun run db:generate
bun run db:migrate
bun run dev

# 3. Frontend (new terminal, port 5173)
cd apps/frontend
cp .env.local.example .env
bun install
bun run dev
```

- Backend: <http://localhost:8787> · API docs: <http://localhost:8787/docs> · Frontend: <http://localhost:5173>

**macOS note:** Homebrew PostgreSQL commonly owns `localhost:5432`. This project deliberately publishes its

Postgres on **5434** (see `docker-compose.local.yml`); keep `DATABASE_URL` pointed there to avoid Prisma P1010.

### Live ESP32 data on Mac (no Arduino changes)

```text
ESP32 → VPS EMQX ←── SSH tunnel ── local backend → local TimescaleDB → dashboard
```

```bash
./scripts/mqtt-tunnel.sh          # forwards 127.0.0.1:1884 → VPS EMQX :1883
```

Then in `apps/backend/.env` set `MQTT_HOST=127.0.0.1`, `MQTT_PORT=1884`. Start the backend; watch `[MQTT] Connected` in logs.

---

## Deployment

Full instructions: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

| Target        | Compose               | Command |
|---------------|-----------------------|---------|
| VPS (prod)    | `docker-compose.yml`  | `sudo docker compose up -d --build` |
| Local Mac     | `docker-compose.local.yml` | imperative `docker compose -f docker-compose.local.yml up -d` + Bun apps |
| Microservices | `docker-compose.modular.yml` | experiment only — **not** for the VPS yet |

Env examples are the source of truth; copy them, never commit real secrets:

| Example | Real file | Use |
|---------|-----------|-----|
| `.env.example` | `.env` | VPS compose substitution |
| `apps/backend/.env.example` | `apps/backend/.env` | VPS backend container |
| `apps/backend/.env.local.example` | `apps/backend/.env` | Mac local backend |
| `apps/frontend/.env.example` | `apps/frontend/.env` | VPS build arg |
| `apps/frontend/.env.local.example` | `apps/frontend/.env` | Mac local frontend |

---

## Data flow & database

### Ingestion

- Devices publish MQTT to `selene/{nodeId}/telemetry`.
- The monolith's MQTT client (or the standalone `services/ingestor`) runs the **parser registry** to match payloads against PZEM-004T (energy) and DHT11 (climate) parsers. One payload may trigger multiple domains.
- Records merge into a single `FlatSensorReading` and are inserted into the `sensor_readings` hypertable.

### Storage

| Data | Engine | Notes |
|------|--------|-------|
| Sensor readings | **TimescaleDB** (`selene_measurements.sensor_readings`) | hypertable, 7-day chunks, `time_bucket()` aggregation |
| Users · auth · settings | PostgreSQL (`selene`), via Prisma | users, login history, notifications, glossary |
| Notifications | PostgreSQL | per-user, via Fastify |

Query entry points: `apps/backend/src/timescale.ts` (monolith) and `packages/shared/src/db/timescale.ts` (shared client used by microservices).

---

## API

Monolith: `GET /docs` for interactive Swagger. All paths below are served under `/api` from the monolith unless noted.

### Auth (`/api/auth/*`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login`, `/login/2fa` | Sign in (with 2FA step) |
| GET | `/me` | Current user |
| PATCH | `/me` | Update profile |
| POST | `/change-password`, `/change-email` | Credentials |
| DELETE | `/delete-account` | Delete account |
| GET | `/2fa/status`, POST `/2fa/enable`, POST `/2fa/disable`, GET `/2fa/backup-codes` | TOTP 2FA |
| POST | `/forgot-password`, `/reset-password` | Password recovery |
| GET | `/login-history`, DELETE `/clear-sessions` | Session management |

### Admin (`/api/admin/*`) — requires Admin
| Path | |
|------|--|
| GET `/users`, GET `/users/:id` | List / details |
| PATCH `/users/:id/role` | Change role |
| PATCH `/users/:id/toggle-active` | Enable / disable |
| DELETE `/users/:id` | Delete account |
| GET `/stats` | System statistics |

### Readings (`/api/readings/*`)
| Path | Description |
|------|-------------|
| GET `/latest` | Latest reading |
| GET `/history?range=` | Aggregated history (`range=24h\|7d\|…`), optional `type=energy` |
| GET `/logs?pageSize=` | Paginated recent logs |
| GET `/export?format=csv\|tsv` | Data export |
| GET `/stream` | Server-Sent Events live feed |

### Analytics (`/api/analytics/*`)
| Path | Description |
|------|-------------|
| GET `/summary?range=` | Power / energy statistics |
| GET `/climate?range=` | Temperature / humidity statistics |
| GET `/fuzzy-distribution?range=` | Energy fuzzy classification |
| GET `/climate-fuzzy-distribution?range=` | Climate fuzzy classification |
| GET `/membership` | Membership functions |
| GET `/decision-surface` | Energy decision surface |
| GET `/box-plot?range=` | Power box plots |
| GET `/bland-altman?range=` | Bland-Altman analysis |

### MQTT / sensors
`GET /api/mqtt/status` · `GET /api/mqtt/nodes` (Admin) · `GET /api/sensors/catalog`

### Firmware (OTA) (`/api/firmware/*`)
`GET /history` · `POST /upload` · `GET /pending` · `GET /result`

### Misc
`GET /api/glossary` · `POST /api/glossary` · `DELETE /api/glossary/:id` · `GET /health`

---

## Analytics & fuzzy engines

- **Energy fuzzy**: 15-rule Mamdani — inputs: voltage, power, power factor, reactive power → `ECONOMICAL` / `NORMAL` / `WASTEFUL`.
- **Climate fuzzy**: 14-rule Mamdani, ASHRAE 55-2020 & SNI 03-6572 — inputs: temperature, humidity → `COLD` / `COOL` / `COMFORTABLE` / `WARM` / `HOT`.
- **Forecasting** — browser-side linear regression + EWMA + hourly pattern match, horizon-scaled from 1h (12 pts, 5 min) to 1y (12 pts, 1 mo).
- Reference implementations: `apps/backend/src/analytics/` (TS) mirror the firmware C++.

---

## Microservices (modular variant)

The repository is structured so the monolith can be **replaced gradually**. `packages/shared` and `packages/sensors` move shared code; `services/*` are independent deployables:

| Service | Port | Status |
|---------|:----:|--------|
| Auth | 3009 | Scaffold |
| Energy | 3002 | **Runnable** (real TimescaleDB queries) |
| Climate | 3003 | **Runnable** (real TimescaleDB queries) |
| Firmware | 3004 | Scaffold |
| Ingestor | 3005 | Runnable (MQTT → parser registry → Timescale) |
| Soil/Lux/Gas/GPS/Generic | — | Stubs |

`docker-compose.modular.yml` and `deploy/Caddyfile.modular` realize this stack: Caddy routes `selene.example/api/v1/energy/*` → energy :3002, `/api/v1/climate/*` → climate :3003, `/api/v1/ingest/*` → ingestor :3005, `/api/v1/auth/*` → auth :3009. **The VPS still runs the monolith stack; changing to modular is a deployment decision — see [docs/MODULAR_MICROSERVICES.md](docs/MODULAR_MICROSERVICES.md).**

---

## Extending with a new sensor

See **[docs/MODULAR_MICROSERVICES.md](docs/MODULAR_MICROSERVICES.md#extensibility-adding-a-new-sensor-module)** for the full playbook. In short:

1. Add a `types` entry in `packages/shared`.
2. Write a parser in `packages/sensors/src/parsers/<name>.ts` (expose `canParse` / `parse`).
3. Register it in `packages/sensors/src/parsers/registry.ts`.
4. Add a hypertable / domain queries.
5. Add a `services/<name>` + Caddy route.
6. Mirror the UI in the frontend.

---

## Developed by

**Danke Hidayat** — [dankehidayat](https://github.com/dankehidayat) · [LinkedIn](https://www.linkedin.com/in/dankehidayat/) · [Bluesky](https://bsky.app/profile/dankehidayat.my.id)

Built as part of the final assignment, Computer Engineering Technology, Vocational School / IPB University.