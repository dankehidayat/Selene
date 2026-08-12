# Deployment

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-12
**Status:** Published
**Type:** Runbook
**Target Environment:** Production

---

## Overview

The Selene production stack runs behind a Caddy reverse proxy. All services are defined in `docker-compose.modular.yml` and substituted from the root `.env` file. Caddy is installed natively on the host and re-reads its config automatically.

---

## Prerequisites & Access

- `sudo` privileges on the production server (Docker, Caddy)
- Git access to `github.com/dankehidayat/selene` (master branch)

---

## Architecture & Context

### Compose stack (canonical: `docker-compose.modular.yml`)

| Service | Container name | Host port | Notes |
|---------|---------------|-----------|-------|
| PostgreSQL | `selene-postgres` | 127.0.0.1:5432 | Users, auth, settings |
| TimescaleDB | `selene-timescaledb` | 127.0.0.1:5433 (internal) | Sensor readings hypertable |
| EMQX | `selene-emqx` | 1883, 127.0.0.1:18083, 8083 | MQTT broker |
| Auth | `selene-auth` | 127.0.0.1:3009 | JWT, 2FA, admin |
| Analytics | `selene-analytics` | 127.0.0.1:3006 | Energy/climate analytics |
| Energy | `selene-energy` | 127.0.0.1:3002 | Energy queries |
| Climate | `selene-climate` | 127.0.0.1:3003 | Climate queries |
| Firmware | `selene-firmware` | 127.0.0.1:3004 | OTA firmware |
| Ingestor | `selene-ingestor` | 127.0.0.1:3005 | MQTT ingest |
| Backend (monolith) | `selene-backend` | 127.0.0.1:8787 | Primary HTTP API |
| Frontend | `selene-frontend` | 127.0.0.1:3000 | React SPA |

### Compose file map

| File | Purpose |
|------|---------|
| **`docker-compose.modular.yml`** | **Production (canonical)** — all services, reads `.env` |
| `docker-compose.yml` | Deprecated lean variant (kept for rollback) |
| `docker-compose.local.yml` | Local development infra (Postgres :5434, Timescale :5433, EMQX) |

### Environment files

| Example file | Real file | Used by |
|--------------|-----------|---------|
| `.env.example` | `.env` | Compose variable substitution |
| `apps/backend/.env.example` | `apps/backend/.env` | Backend container `env_file` |
| `apps/frontend/.env.example` | `apps/frontend/.env` | Vite build arg reference |

Never commit real `.env` files. Copy from `.env.example` and fill.

### Caddy routing

`deploy/Caddyfile.modular` runs on the host:

| Domain / path | Target | Notes |
|---------------|--------|-------|
| `selene.dankehidayat.my.id` | | |
| `/health` | `localhost:3009` | Auth service health |
| `/api/v1/*` | `localhost:8787` | Strips `/v1` → monolith bridge |
| `/api/*`, `/docs*` | `localhost:8787` | Monolith bridge |
| `/*` | `localhost:3000` | SPA |
| `emqx.dankehidayat.my.id` | `localhost:18083` | EMQX Dashboard |

---

## Escalation Paths

**Sole maintainer:** Danke Hidayat — contact via GitHub Issues or direct message.

---

## Pre-flight checklist

Before any deployment:

- [ ] Local `git status` is clean
- [ ] `git pull origin master` shows latest commits
- [ ] Root `.env` has all required vars (compare with `.env.example`)
- [ ] `apps/backend/.env` has all required vars (compare with `apps/backend/.env.example`)
- [ ] Server disk space: `df -h` (need at least 5 GB free for images and volumes)
- [ ] Docker Compose is installed: `docker compose version`

---

## Step-by-step: full deploy

### 1. Pull latest code

```bash
cd ~/Developer/Selene
git pull origin master
```

### 2. Build and start

```bash
sudo docker compose -f docker-compose.modular.yml build
sudo docker compose -f docker-compose.modular.yml up -d
```

### 3. Verify health

```bash
# Check all containers are running
sudo docker ps --filter network=selene_selene

# API health
curl -s http://127.0.0.1:8787/health

# Backend MQTT connection
sudo docker logs selene-backend --tail 10 | grep -i mqtt
# Expect: "[MQTT] Connected"

# EMQX dashboard
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18083/status
# Expect: 200

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://selene.dankehidayat.my.id
# Expect: 200

# Prisma schema (on migration)
sudo docker exec selene-backend bunx prisma db push 2>&1 | tail -3
```

### 4. Verify data flow

```bash
# Latest reading
curl -s http://127.0.0.1:8787/api/readings/latest | head -c 200

# Analytics (7d summary)
curl -s "http://127.0.0.1:8787/api/analytics/summary?range=7d" | python3 -m json.tool | head -20
```

---

## Step-by-step: quick update (code-only)

When no infrastructure changes are needed (no new env vars, no schema changes):

```bash
cd ~/Developer/Selene
git pull origin master
sudo docker compose -f docker-compose.modular.yml build backend frontend
sudo docker compose -f docker-compose.modular.yml up -d backend frontend
```

---

## Step-by-step: rollback

```bash
cd ~/Developer/Selene
git log --oneline -5
# Pick a commit hash to roll back to, e.g. abc1234
git checkout abc1234

# Rebuild and restart
sudo docker compose -f docker-compose.modular.yml build
sudo docker compose -f docker-compose.modular.yml up -d

# Verify (see step 3)
# When done, return to master:
git checkout master
```

---

## Troubleshooting

### EMQX crash-loop (restarts every ~43 s)

**Cause:** `EMQX_API_KEY__BOOTSTRAP_FILE` in `.env` but no file mounted. See `docs/03-EMQX-MQTT-RECOVERY.md`.

**Fix:** `sed -i '/EMQX_API_KEY__BOOTSTRAP_FILE/d; /EMQX_BOOTSTRAP_SECRET/d' .env` then restart.

### "No data in range" / frontend crash on 1h/24h

**Cause:** Pre-Aug-10 build. See `docs/05-ANALYTICS-TRIAGE.md`.

**Fix:** `git pull && build backend frontend && up -d`.

### EMQX dashboard credentials not accepted

Dashboard creds only seed on a **fresh** `emqx_data` volume. On existing volumes, use the API to update: `curl -u admin:<old-pass> -X PUT http://127.0.0.1:18083/api/v5/dashboard/admin -H "Content-Type: application/json" -d '{"password":"<new-pass>"}'`

### MQTT `not_authorized`

Device user `selene` must exist in EMQX's built_in_database. Create via dashboard API (see docs/03-EMQX-MQTT-RECOVERY.md).

### RESEND_API_KEY empty in container

Do not set `RESEND_API_KEY=` (empty) in Compose `environment:` — host values overwrite the container's `env_file`. The var should only be in `apps/backend/.env`.

---

## 2026-08-12 cutover appendix

On 2026-08-12 the stack was migrated from `docker-compose.yml` (lean variant) to `docker-compose.modular.yml` (canonical). Changes applied:

1. EMQX bootstrap mechanism removed (no `EMQX_API_KEY__BOOTSTRAP_FILE`, no `emqx-init` service, no `deploy/emqx-api-key.conf`)
2. All credentials sourced from root `.env` only (no hardcoding in compose)
3. Container names aligned (`selene-emqx`, `selene-timescaledb`, etc.)
4. `scripts/deploy.sh` deleted (its logic is now in this runbook)
5. Orphaned volumes `db-data` and `tsdata` (from an earlier modular stack) identified but not deleted

### Cutover steps run

```bash
# 1. Stop old stack
sudo docker compose -f docker-compose.yml down

# 2. Remove bootstrap vars from .env
sed -i '/EMQX_API_KEY__BOOTSTRAP_FILE/d; /EMQX_BOOTSTRAP_SECRET/d' .env

# 3. Start new stack
sudo docker compose -f docker-compose.modular.yml up -d --build

# 4. Verify
sudo docker ps
curl -s http://127.0.0.1:8787/health
sudo docker logs selene-backend --tail 5 | grep -i mqtt

# 5. Clean up orphaned volumes (after confirming old data is not needed)
sudo docker volume rm selene_db-data selene_tsdata 2>/dev/null; echo "done"
```