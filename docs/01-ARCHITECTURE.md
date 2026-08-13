# Architecture

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-14
**Status:** Published
**Type:** Reference
**Target Environment:** Production

---

## Overview

Selene is a real-time smart energy and climate monitoring platform. ESP32-based sensors (PZEM-004T + DHT11) stream telemetry over MQTT to an EMQX broker. A Fastify monolith ingests, stores, and serves analytics through **two clients**: a React SPA dashboard (web) and a native Android app (Jetpack Compose, in a separate repository at `dankehidayat/Selene-mobile`). The codebase is structured for gradual migration toward domain-split microservices behind a Caddy gateway.

**Field hardware today:** ESP32 + PZEM-004T + DHT11
**Edge firmware:** [Eco-Office feat/selene-mqtt-ota](https://github.com/dankehidayat/Eco-Office/blob/feat/selene-mqtt-ota/Eco%20Office.ino)

---

## Architecture diagram

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
        ┌───────────┴───────────┐
        ▼                       ▼
  React SPA (web)        Android app (Selene-mobile)
```

- The **monolith** (`apps/backend`, port 8787) is the primary production API and MQTT ingestor. Both the web frontend and the Android client talk to `/api/*` on it.
- A **microservices variant** (`services/`, via `docker-compose.modular.yml`) splits domains behind a Caddy gateway. Caddy exposes the `/api/v1/*` contract, and until each service is cut over, the monolith serves it as a bridge. `services/auth` (3009) is fully implemented and is the first microservice ready to take over routes.
- PostgreSQL stores users, auth sessions, and app settings. All sensor readings live in TimescaleDB.
- **Mobile client:** the native Android app (`Jetpack Compose`, Material 3, dark-exclusive) lives in a separate repo — `dankehidayat/Selene-mobile` (local path `/Users/ltna01/Developer/Selene-mobile`). It consumes the same `/api/*` contract via Retrofit; its API map is `docs/MOBILE_API.md` in that repo.

---

## Service definitions

| Service | Port | Status | Responsibility |
|---------|------|--------|----------------|
| Auth | 3009 | **Implemented / Runnable** | Users, JWT v2 (EdDSA), roles, 2FA, refresh rotation, admin, notifications, glossary |
| Analytics | 3006 | **Runnable** | Energy/climate analytics (TimescaleDB reads) |
| Energy | 3002 | **Runnable** | PZEM analytics / fuzzy energy (TimescaleDB reads) |
| Climate | 3003 | **Runnable** | DHT11 analytics / climate fuzzy (TimescaleDB reads) |
| Firmware | 3004 | Scaffold | OTA upload + MQTT command |
| Ingestor | 3005 | **Runnable** | MQTT + parser registry + Timescale insert |
| Frontend | 3000 | Core | Dashboard (published via `FRONTEND_PORT`) |
| Monolith | 8787 | **Transition (production today)** | Full API until services cut over |

---

## Data flow

### Ingestion

- Devices publish MQTT to `selene/{nodeId}/telemetry`
- The monolith's MQTT client (or the standalone `services/ingestor`) runs the **parser registry** to match payloads against PZEM-004T (energy) and DHT11 (climate) parsers. One payload may trigger multiple domains
- Records merge into a single `FlatSensorReading` and are inserted into the `sensor_readings` hypertable

### Storage

| Data | Engine | Notes |
|------|--------|-------|
| Sensor readings | **TimescaleDB** (`selene_measurements.sensor_readings`) | Hypertable, 7-day chunks, `time_bucket()` aggregation |
| Users, auth, settings | PostgreSQL (`selene`), via Prisma | Users, login history, notifications, glossary |
| Notifications | PostgreSQL | Per-user, via Fastify |

Query entry points: `apps/backend/src/timescale.ts` (monolith) and `packages/shared/src/db/timescale.ts` (shared client used by microservices).

---

## Database strategy

### Hypertable: `sensor_readings`

| Column | Type | Domain |
|--------|------|--------|
| `time` | TIMESTAMPTZ | PK (sort key) |
| `ac_voltage` | NUMERIC | Energy |
| `ac_current` | NUMERIC | Energy |
| `ac_power` | NUMERIC | Energy |
| `cos_phi` | NUMERIC | Energy |
| `apparent_power` | NUMERIC | Energy |
| `total_energy` | NUMERIC | Energy (kWh, cumulative counter) |
| `frequency` | NUMERIC | Energy (Hz, default 50) |
| `reactive_power` | NUMERIC | Energy (VAR) |
| `temperature` | NUMERIC | Climate (°C) |
| `humidity` | NUMERIC | Climate (% RH) |
| `temp_comfort` | TEXT | Climate (COMFORTABLE / COLD / WARM / HOT) |
| `energy_status` | TEXT | Energy (NORMAL / ECONOMICAL / WASTEFUL) |
| `current_per_kw` | NUMERIC | Energy |
| `power_quality_score` | NUMERIC | Energy |
| `energy_cost` | TEXT | Energy (formatted currency) |
| `voltage_stability` | NUMERIC | Energy |

No primary key or unique constraint. Continuous aggregates refresh automatically via policies.

### Continuous aggregates (CAGGs)

| CAGG | Bucket | Refresh policy | Use |
|------|--------|----------------|-----|
| `sensor_readings_5m` | 5 minutes | 2-day lookback, 5-minute refresh | 24h / 7d analytics |
| `sensor_readings_1h` | 1 hour | 30-day lookback, 1-hour refresh | 30d+ analytics |

CAGGs are created `WITH NO DATA` and backfilled at boot. Each stores AVG per bucket, plus min/max power, last comfort/status, and row count `n`.

### Future extensions

Additional sensor domains (soil, lux, gas, etc.) would follow the same pattern: new parser in `packages/sensors`, new hypertable in TimescaleDB, new `services/<name>` microservice, new Caddy route.

---

## Parser registry pattern

```ts
parserRegistry = [
  { id: "energy",  detect: canParseEnergy,  parse: ... },  // PZEM-004T
  { id: "climate", detect: canParseClimate, parse: ... },  // DHT11
];
```

`runParserRegistry(nodeId, payload)` returns `{ domains, merged: FlatSensorReading, shouldDrop }`. One payload can fire multiple parsers.

### Adding a new sensor module

1. Add types in `packages/shared/src/types/sensors.ts`
2. Write parser in `packages/sensors/src/parsers/<name>.ts` (export `canParse` / `parse`)
3. Register in `packages/sensors/src/parsers/registry.ts`
4. Add hypertable migration
5. Add `services/<name>` microservice + Caddy route
6. Add frontend components

---

## API Gateway routing

`deploy/Caddyfile.modular` routes:

| Path | Target | Notes |
|------|--------|-------|
| `/health` | `localhost:3009` | Auth service health |
| `/api/v1/*` | `localhost:8787` | Rewrites `/v1` → monolith (bridge; microservice cutover pending) |
| `/api/*` | `localhost:8787` | Monolith bridge |
| `/docs*` | `localhost:8787` | Swagger UI |
| `/*` | `localhost:3000` | SPA |
| `emqx.dankehidayat.my.id` | `localhost:18083` | EMQX dashboard |

Monolith registers routes at `/api/*`. The Caddy rewrite strips `/v1` so `/api/v1/readings/latest` becomes `/api/readings/latest` → monolith. When a microservice takes over a route (auth first), its Caddy handler goes above the monolith bridge.

---

## HTTP API surface

Monolith: `GET /docs` for interactive Swagger. OpenAPI spec at `docs/openapi.yml`.

### Auth (`/api/auth/*`)

POST `/register`, `/login`, `/login/2fa` · GET `/me` · PATCH `/me` · POST `/change-password`, `/change-email` · DELETE `/delete-account` · GET `/2fa/status` · POST `/2fa/enable`, `/2fa/disable` · GET `/2fa/backup-codes` · POST `/forgot-password`, `/reset-password` · GET `/login-history` · DELETE `/clear-sessions`

### Admin (`/api/admin/*`) — requires Admin

GET `/users`, `/users/:id` · PATCH `/users/:id/role`, `/users/:id/toggle-active` · DELETE `/users/:id` · GET `/stats`

### Readings (`/api/readings/*`)

GET `/latest` · GET `/history?range=&from=&to=&type=` · GET `/logs?pageSize=` · GET `/export?format=csv|tsv` · GET `/stream` (SSE)

### Analytics (`/api/analytics/*`)

GET `/summary?range=&from=&to=` · GET `/climate?range=&from=&to=` · GET `/fuzzy-distribution?range=&from=&to=` · GET `/climate-fuzzy-distribution?range=&from=&to=` · GET `/membership` · GET `/decision-surface` · GET `/box-plot?range=&from=&to=` · GET `/bland-altman?range=&from=&to=`

### MQTT / Sensors

GET `/api/mqtt/status` · GET `/api/mqtt/nodes` (Admin) · GET `/api/sensors/catalog`

### Firmware (OTA)

GET `/history` · POST `/upload` · GET `/pending` · GET `/result`

### Misc

GET `/api/glossary` · POST `/api/glossary` · DELETE `/api/glossary/:id` · GET `/health`

---

## Analytics and fuzzy engines

- **Energy fuzzy:** 15-rule Mamdani — inputs: voltage, power, power factor, reactive power → `ECONOMICAL` / `NORMAL` / `WASTEFUL`
- **Climate fuzzy:** 14-rule Mamdani (ASHRAE 55-2020 & SNI 03-6572) — inputs: temperature, humidity → `COLD` / `COOL` / `COMFORTABLE` / `WARM` / `HOT`
- **Forecasting:** browser-side linear regression + EWMA + hourly pattern match, horizon-scaled from 1h (12 pts, 5 min) to 1y (12 pts, 1 mo)
- Reference implementations: `apps/backend/src/analytics/` (TypeScript) mirror the firmware C++

### Known analytics limitations

- Climate degree-hours computation has no gap cap (≤ 5 min recommended); ranges spanning the Apr 30 → Jul 9, 2026 data gap inflate results. Fix planned.
- Energy cumulative counter math excludes all-zero placeholder rows; was fixed in commit `bbd36423` (2026-08-10) to prevent inflation from offline blips.

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
  auth/       Users, JWT v2 (EdDSA), roles, 2FA, notifications — implemented (:3009)
  analytics/  Energy/climate analytics (TimescaleDB reads) (:3006)
  energy/     Energy analytics (TimescaleDB reads) (:3002)
  climate/    Climate analytics (TimescaleDB reads) (:3003)
  firmware/   OTA upload + MQTT commands (scaffold)
deploy/
  Caddyfile.modular           Caddy gateway for the microservices variant
docker-compose.modular.yml    Production compose stack (canonical)
docker-compose.yml            Deprecated lean variant (kept for rollback)
docker-compose.local.yml      Local development infra only
docs/
  01-ARCHITECTURE.md          This document
  02-DEPLOYMENT.md            Deployment runbook
  03-EMQX-MQTT-RECOVERY.md    EMQX/MQTT recovery runbook
  04-DATA-RECOVERY.md         Data backup and restoration
  05-ANALYTICS-TRIAGE.md      Analytics incident triage
  06-SECURITY-ADMIN-ELEVATION.md  Security specification
  07-CREDENTIAL-ROTATION.md   Credential rotation procedure
  08-LOCAL-DEVELOPMENT.md     Local development guide
  openapi.yml                 OpenAPI specification (renamed from openapi-v1.yml)
```

---

## Microservices migration status

| Phase | Action | Status |
|-------|--------|--------|
| 1. Shared packages | `@selene/shared`, `@selene/sensors` | **Done** |
| 2. Split by domain | `services/*` | Auth (:3009) + analytics (:3006) + energy (:3002) + climate (:3003) implemented; firmware scaffold |
| 3. Ingestor primary | Standalone ingest process | **Runnable** (:3005) |
| 4. Gateway cutover | Enable per-domain Caddy routes above the monolith bridge (auth first) | Next |
| 5. Decommission monolith | Caddy → microservices only | Not started |

---

## Edge firmware (separate repository)

| Repo | Branch | Path |
|------|--------|------|
| [dankehidayat/Eco-Office](https://github.com/dankehidayat/Eco-Office) | `feat/selene-mqtt-ota` | `Eco Office.ino` (repo root) — energy + environment + MQTT OTA |
| Eco-Office `main` | — | Final report + original sketch only |

Configure MQTT/Blynk placeholders in the sketch locally; never commit tokens.