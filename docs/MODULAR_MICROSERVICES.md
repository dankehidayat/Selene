# Selene — Modular Microservices Architecture for Extensible IoT Sensor Integration

> **Branch:** `feat/modular-microservices`  
> **Field hardware today:** ESP32 + **PZEM-004T** + **DHT11**  
> **Edge firmware:** [Eco-Office `feat/selene-mqtt-ota`](https://github.com/dankehidayat/Eco-Office/blob/feat/selene-mqtt-ota/Eco%20Office.ino) — root `Eco Office.ino` (PZEM energy + DHT11 environment); secrets blank in git  
> Extension examples (lux, soil, …) are **contracts only** until hardware exists.

---

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture](#current-architecture)
3. [Target Microservices Architecture](#target-microservices-architecture)
4. [Service Definitions](#service-definitions)
5. [Data Flow: Existing Sensors](#data-flow-existing-sensors)
6. [Extensibility: Adding a New Sensor Module](#extensibility-adding-a-new-sensor-module)
7. [Shared Package Design](#shared-package-design)
8. [Ingestor Parser Registry Pattern](#ingestor-parser-registry-pattern)
9. [Database Strategy](#database-strategy)
10. [API Gateway Routing](#api-gateway-routing)
11. [Deployment with Docker Compose](#deployment-with-docker-compose)
12. [Migration Path](#migration-path)
13. [Example: Adding a Lux Sensor](#example-adding-a-lux-sensor)
14. [Example: Adding a Soil Sensor (NPK/pH/EC)](#example-adding-a-soil-sensor-npkphec)
15. [Benefits Summary](#benefits-summary)
16. [Repository Map (implemented)](#repository-map-implemented)

---

## Overview

Transition from a monolithic Fastify backend to an extensible microservices architecture. Supports **PZEM-004T (energy)** and **DHT11 (climate)** while leaving structured extension points for soil NPK/pH/EC, lux, GPS, gas, water level, pressure, etc.

---

## Current Architecture

- **Monolith** `apps/backend` :8787 still serves the full HTTP API (auth, analytics, OTA, readings).
- **Ingest** uses `@selene/sensors` **parser registry** (energy + climate) inside the monolith MQTT client; optional standalone `services/ingestor` :3005.
- **Frontend** `apps/frontend` :5173.

---

## Target Microservices Architecture

| Layer | Components |
|-------|------------|
| Device | ESP32 → MQTT `selene/{nodeId}/telemetry` |
| Broker | EMQX :1883 |
| Core | Ingestor :3005, Auth :3001, Energy :3002, Climate :3003, Firmware :3004 |
| Extensions | Soil :3006, Lux :3007, GPS :3008, Gas :3009, Generic :3010 |
| Data | PostgreSQL (users), TimescaleDB (readings) |
| Gateway | Caddy path routing (`deploy/Caddyfile.modular`) |

**Principles:** single responsibility, shared types, MQTT bus, Caddy gateway, new sensors = parser + service without editing energy/climate/auth.

---

## Service Definitions

| Service | Port | Status | Responsibility |
|---------|------|--------|----------------|
| Auth | 3001 | Scaffold | Users, JWT, roles, glossary, admin |
| Energy | 3002 | Scaffold | PZEM analytics / fuzzy energy |
| Climate | 3003 | Scaffold | DHT11 analytics / climate fuzzy |
| Firmware | 3004 | Scaffold | OTA upload + MQTT command |
| Ingestor | 3005 | **Runnable** | MQTT + registry + Timescale insert |
| Soil–Generic | 3006–3010 | Extension stubs | Future domains |
| Frontend | 5173 / 4173 | Core | Dashboard |
| Monolith | 8787 | Transition | Full API until Phase 4 |

---

## Data Flow: Existing Sensors

```
ESP32 publishes { voltage, current, power, temperature, humidity, … }
  → EMQX selene/office-main/telemetry
  → Ingestor / monolith MQTT
  → canParseEnergy (PZEM) + canParseClimate (DHT11)
  → merge → INSERT sensor_readings
  → Energy/Climate APIs (monolith today; services later) → Frontend
```

One payload can fire **multiple** parsers.

---

## Extensibility: Adding a New Sensor Module

1. Type in `packages/shared/src/types/sensors.ts`  
2. Parser in `packages/sensors/src/parsers/<name>.ts` (`canParse` / `parse`)  
3. Register in `packages/sensors/src/parsers/registry.ts`  
4. Hypertable migration  
5. `services/<name>` + Caddy handle  
6. Frontend component  

---

## Shared Package Design

```
packages/shared/src/
  types/{energy,climate,sensors,auth}.ts
  db/timescale.ts
  mqtt-client.ts
  middleware/auth.ts
  topics.ts capabilities.ts telemetry.ts ports.ts
packages/sensors/src/
  modules/{pzem004t,dht11}.ts
  parsers/{energy,climate,registry}.ts
```

---

## Ingestor Parser Registry Pattern

```ts
parserRegistry = [
  { id: "energy",  detect: canParseEnergy,  parse: … },  // PZEM-004T
  { id: "climate", detect: canParseClimate, parse: … },  // DHT11
  // { id: "lux", … },
];
```

`runParserRegistry(nodeId, payload)` → domains + merged `FlatSensorReading` + `shouldDrop`.

---

## Database Strategy

| Hypertable | Domain |
|------------|--------|
| `sensor_readings` | Energy + Climate (current columns) |
| `lux_readings` / `soil_readings` / … | Extensions |

PostgreSQL/Prisma: users, glossary, notifications, login history.

---

## API Gateway Routing

See `deploy/Caddyfile.modular` — core prefixes + commented extensions + monolith fallback for `/api/*`.

---

## Deployment with Docker Compose

| File | Use |
|------|-----|
| `docker-compose.local.yml` | Daily Mac dev (infra + monolith) |
| `docker-compose.modular.yml` | Infra + service profile `services` |
| `docker-compose.production.yml` | Production stack |

```bash
docker compose -f docker-compose.modular.yml up -d
docker compose -f docker-compose.modular.yml --profile services up -d --build
```

---

## Migration Path

| Phase | Action | Status |
|-------|--------|--------|
| 1. Shared packages | `@selene/shared`, `@selene/sensors` | **Done** |
| 2. Split by domain | `services/*` scaffolds | **Done (scaffolds)** |
| 3. Ingestor primary | Standalone ingest process | **Runnable** |
| 4. Decommission monolith | Caddy → microservices only | Not started |

---

## Example: Adding a Lux Sensor

1. `LuxReading` in shared types (already stubbed in `types/sensors.ts`)  
2. `packages/sensors/src/parsers/lux.ts` with `canParse` / `parse`  
3. Push onto `parserRegistry`  
4. `CREATE TABLE lux_readings …` hypertable  
5. `services/lux` + Caddy `/api/lux/*`  
6. Frontend `LuxDashboard`  

---

## Example: Adding a Soil Sensor (NPK/pH/EC)

Same pattern: detect `nitrogen` / `npk_n` → `soil_readings` → `services/soil` :3006.

---

## Benefits Summary

Independent deployability, zero-downtime extensions, fault isolation, parser registry, shared type safety, gradual migration.

---

## Repository Map (implemented)

```
packages/shared/          # types, timescale helper, mqtt factory, JWT helpers
packages/sensors/         # PZEM + DHT11 modules + parser registry
services/ingestor/        # real MQTT → registry → Timescale
services/{auth,energy,climate,firmware}/  # Phase 2 scaffolds
services/{soil,lux,gps,gas,generic}/      # extension stubs
deploy/Caddyfile.modular
docker-compose.modular.yml
docker-compose.yml        # VPS / production stack
apps/backend/             # monolith (still primary HTTP API)
apps/frontend/
```

### Edge firmware (separate repo)

| Repo | Branch | Path |
|------|--------|------|
| [dankehidayat/Eco-Office](https://github.com/dankehidayat/Eco-Office) | `feat/selene-mqtt-ota` | **`Eco Office.ino`** (repo root) — energy + environment + MQTT OTA |
| Eco-Office `main` | — | Final report + original sketch only — do not put Selene secrets there |

Configure MQTT/Blynk placeholders in the sketch locally; never commit tokens.

### Commands

```bash
bun install
bun run test:sensors
bun run dev:backend          # monolith + ingest
bun run dev:ingestor         # standalone ingestor only
```
