# Selene

Real-time smart energy and climate monitoring for IoT sensor fleets. ESP32-based sensors stream telemetry over MQTT; Selene ingests, stores, and visualizes time-series data with statistical and fuzzy-logic analytics — served by a Fastify monolith with an optional path toward domain-split microservices.

[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black)](https://bun.sh)

---

## Highlights

- **Live dashboard** — energy (voltage, current, power, power factor, frequency) and climate (temperature, humidity) with a real-time SSE stream.
- **TimescaleDB ingestion** — raw SQL ingest and analytic queries against the `sensor_readings` hypertable.
- **Fuzzy analytics** — 15-rule energy and 14-rule climate Mamdani inference engines, Bland-Altman, box plots, decision surfaces.
- **Client-side ML forecasting** — linear regression + exponential smoothing + hourly pattern-matching ensemble.
- **Auth and RBAC** — JWT sessions, roles (User/Admin), 2FA (TOTP), password reset, login history, notifications.
- **OTA firmware management** — upload and track ESP32 OTA firmware.
- **Extensible microservices** — parser-registry architecture for adding new sensor domains.

---

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
- A **microservices variant** (`services/`, via `docker-compose.modular.yml`) splits domains behind a Caddy gateway. Caddy exposes the `/api/v1/*` contract, and until each service is cut over, the monolith serves it as a bridge. `services/auth` (3009) is fully implemented and is the first microservice ready to take over routes.
- PostgreSQL stores users, auth sessions, and app settings. All sensor readings live in TimescaleDB.

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
  auth/       (microservice) users, JWT v2 (EdDSA), roles, 2FA, notifications — implemented (:3009)
  analytics/  (microservice) energy/climate analytics (:3006)
  energy/     (microservice) energy analytics (:3002)
  climate/    (microservice) climate analytics (:3003)
  firmware/   (microservice) OTA upload + MQTT commands (scaffold)
deploy/
  Caddyfile.modular             Caddy gateway for the microservices variant
docker-compose.modular.yml      Production compose stack (canonical)
docker-compose.yml              Deprecated lean variant (kept for rollback)
docker-compose.local.yml        Local development infra only
docs/                           Documentation (see section below)
```

---

## Data flow and storage

### Ingestion

- Devices publish MQTT to `selene/{nodeId}/telemetry`.
- The monolith's MQTT client (or the standalone `services/ingestor`) runs the **parser registry** to match payloads against PZEM-004T (energy) and DHT11 (climate) parsers. One payload may trigger multiple domains.
- Records merge into a single `FlatSensorReading` and are inserted into the `sensor_readings` hypertable.

### Storage

| Data | Engine | Notes |
|------|--------|-------|
| Sensor readings | **TimescaleDB** (`selene_measurements.sensor_readings`) | Hypertable, 7-day chunks, `time_bucket()` aggregation |
| Users, auth, settings | PostgreSQL (`selene`), via Prisma | Users, login history, notifications, glossary |
| Notifications | PostgreSQL | Per-user, via Fastify |

Query entry points: `apps/backend/src/timescale.ts` (monolith) and `packages/shared/src/db/timescale.ts` (shared client used by microservices).

---

## Analytics and fuzzy engines

- **Energy fuzzy:** 15-rule Mamdani — inputs: voltage, power, power factor, reactive power → `ECONOMICAL` / `NORMAL` / `WASTEFUL`.
- **Climate fuzzy:** 14-rule Mamdani, ASHRAE 55-2020 and SNI 03-6572 — inputs: temperature, humidity → `COLD` / `COOL` / `COMFORTABLE` / `WARM` / `HOT`.
- **Forecasting:** browser-side linear regression + EWMA + hourly pattern match, horizon-scaled from 1h (12 pts, 5 min) to 1y (12 pts, 1 mo).
- Reference implementations: `apps/backend/src/analytics/` (TypeScript) mirror the firmware C++.

---

## Documentation

| # | Document | Type |
|---|----------|------|
| 01 | [Architecture](docs/01-ARCHITECTURE.md) | Reference — stack, services, data flow, parser registry, Caddy routing, API surface |
| 02 | [Deployment](docs/02-DEPLOYMENT.md) | Runbook — production deploy, build, verify, rollback, troubleshooting |
| 03 | [EMQX / MQTT Recovery](docs/03-EMQX-MQTT-RECOVERY.md) | Runbook — crash-loop, not_authorized, ECONNREFUSED, dashboard access |
| 04 | [Data Recovery](docs/04-DATA-RECOVERY.md) | Runbook — backup, restore, deduplicate, CAGG refresh, sheet import |
| 05 | [Analytics Triage](docs/05-ANALYTICS-TRIAGE.md) | Runbook — empty-range crash, energy inflation, degree-hours gap, diagnostic SQL |
| 06 | [Security Admin Elevation](docs/06-SECURITY-ADMIN-ELEVATION.md) | Specification — role-elevation security layers |
| 07 | [Credential Rotation](docs/07-CREDENTIAL-ROTATION.md) | Runbook — rotate DB, JWT, MQTT, EMQX, Resend secrets |
| 08 | [Local Development](docs/08-LOCAL-DEVELOPMENT.md) | Guide — local infra, Bun dev, MQTT tunnel |

Additional references:
- [OpenAPI specification](docs/openapi.yml) — versioned REST API contract
- [Changelog](CHANGELOG.md) — release history and planned changes

---

## Developed by

**Danke Hidayat** — [dankehidayat](https://github.com/dankehidayat) · [LinkedIn](https://www.linkedin.com/in/dankehidayat/) · [Bluesky](https://bsky.app/profile/dankehidayat.my.id)

Built as part of the final assignment, Computer Engineering Technology, Vocational School / IPB University.