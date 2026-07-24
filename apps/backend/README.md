# @selene/backend

Fastify API for Selene: auth, readings, analytics, MQTT ingest, and OTA orchestration.

## Stack

- **Runtime:** Bun  
- **Framework:** Fastify  
- **App DB:** PostgreSQL + Prisma  
- **Time-series:** TimescaleDB (`pg`)  
- **Broker:** EMQX (MQTT)  
- **Shared packages:** `@selene/shared`, `@selene/sensors` (PZEM-004T + DHT11 parsers)

## Local development

From monorepo root (or this folder with workspace install):

```bash
# infra
docker compose -f ../../docker-compose.local.yml up -d

cp .env.local.example .env   # or use existing .env
# DATABASE_URL → 127.0.0.1:5434
# TIMESCALE_URL → 127.0.0.1:5433
# MQTT_* → local EMQX or VPS tunnel (see root README)

bun install                  # from monorepo root preferred
bun run db:generate
bun run dev                  # http://localhost:8787
```

Docs: http://localhost:8787/docs  

## Production (VPS)

- Env files: root `.env` + `apps/backend/.env` (see monorepo `.env.example`)  
- Image build context is **monorepo root** (`apps/backend/Dockerfile`) so workspace packages resolve  
- MQTT: `MQTT_HOST=emqx` (compose service name)

```bash
docker compose build backend
docker compose up -d
docker exec selene-backend bunx prisma generate
```

## Edge firmware (not in this repo)

ESP32 sketch (energy + environment telemetry + OTA) is maintained in:

**https://github.com/dankehidayat/Eco-Office** branch **`feat/selene-mqtt-ota`**  
→ root file **`Eco Office.ino`** (overwrites the main-branch sketch on that branch only)

Backend OTA API:

| Method | Path | Role |
|--------|------|------|
| POST | `/api/firmware/upload` | Admin: store `.bin`, publish MQTT `ota` command |
| GET | `/api/firmware/download/:nodeId` | ESP32: download binary |
| POST | `/api/firmware/result` | ESP32: optional success/fail report |
| GET | `/api/firmware/history` | Admin: recent OTA jobs |

MQTT command topic: `selene/<NODE_ID>/command`  
Telemetry topic: `selene/<NODE_ID>/telemetry`

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Dev server with `.env` |
| `bun run start` | Production entry |
| `bun run db:generate` | Prisma client |
| `bun run db:migrate` | Migrate (dev) |
| `bun run db:push` | Push schema |

## Related docs

- [Root README](../../README.md)  
- [Modular microservices](../../docs/MODULAR_MICROSERVICES.md)  
