# Selene — which Docker Compose / env files to use

## Quick answer

| Machine | Compose file | Command | Env files |
|---------|--------------|---------|-----------|
| **VPS (production)** | `docker-compose.modular.yml` | `sudo docker compose -f docker-compose.modular.yml up -d --build` | `.env` + frontend build arg from root `.env` |
| **Local Mac (dev)** | `docker-compose.local.yml` | `docker compose -f docker-compose.local.yml up -d` | `apps/backend/.env` from `.env.local.example`; infra passwords are in the compose file |

`docker-compose.yml` is a **consolidated alias** of the same VPS stack (same services,
one file). On the VPS the modular variant is canonical because it defines the
Caddy-routed service ports (`selene-monolith`, `selene-auth`, …).

`docker-compose.production.yml` is an old duplicate of `docker-compose.yml` kept
for naming compatibility.

---

## File naming map

### Compose

| File | Audience |
|------|----------|
| **`docker-compose.modular.yml`** | **Production / VPS** — postgres, timescale, emqx, emqx-init, auth, analytics, energy, climate, firmware, ingestor, monolith, frontend |
| **`docker-compose.yml`** | Consolidated alias (same services, fewer explicit ports) |
| **`docker-compose.production.yml`** | Historical duplicate |
| **`docker-compose.local.yml`** | **Local Mac** — Postgres on **5434**, Timescale **5433**, EMQX open ports |

### Env examples → real files

| Example (committed) | Copy to (gitignored) | Used by |
|---------------------|----------------------|---------|
| **`.env.example`** | **`.env`** | VPS compose (`env_file: .env`) |
| **`.env.local.example`** | optional notes / local docs | Local infra reference |
| **`apps/backend/.env.example`** | **`apps/backend/.env`** | VPS backend container |
| **`apps/backend/.env.local.example`** | **`apps/backend/.env`** (on Mac) | Local `bun run dev` |
| **`apps/frontend/.env.example`** | **`apps/frontend/.env`** | Production API URL docs / build |
| **`apps/frontend/.env.local.example`** | **`apps/frontend/.env`** (on Mac) | Vite `VITE_API_BASE_URL=/api` |
| `*.production.example` | same as `*.example` | Aliases for clarity |

Never commit real `.env` files.

---

## VPS (production)

```bash
cd ~/Developer/Selene
git pull   # master (v1.0.0) or feat/api-v1-microservices

# Keep existing secrets — only create if missing:
# cp -n .env.example .env
# cp -n apps/backend/.env.example apps/backend/.env

# ── After pull: ensure email + 2FA vars exist (append if missing) ──
# Use a *new* Resend key (never commit; rotate if leaked).
# Root .env (compose substitution) AND apps/backend/.env (container env_file):
#
#   RESEND_API_KEY=re_xxxxxxxx
#   RESEND_FROM=Selene <onboarding@resend.dev>
#   APP_PUBLIC_URL=https://selene.dankehidayat.my.id
#   TOTP_ISSUER=Selene

sudo docker compose -f docker-compose.modular.yml up -d --build

# Schema sync: images run `prisma generate` + `prisma db push` at build time
# (see Dockerfile / docker-entrypoint.sh). If login fails with P2022 / a missing
# column, push once manually:
sudo docker exec selene-monolith bunx prisma db push
sudo docker restart selene-monolith

sudo docker logs -f selene-monolith
```

Caddy (`deploy/Caddyfile.modular`) proxies on the host:

- `/api/v1/*` → strips `/v1` → `localhost:8787` (monolith serves the full API as a
  **v1 bridge** until microservices cut over; `services/auth` :3009 is the first
  candidate — see CHANGELOG Unreleased)
- `/api/*`, `/docs*`, `/health` → `localhost:8787`
- SPA → `localhost:3000`
- `emqx.dankehidayat.my.id` → dashboard `localhost:18083`

### Email (Resend) + 2FA env checklist

| Variable | Where | Purpose |
|----------|--------|---------|
| `RESEND_API_KEY` | **`apps/backend/.env` only** (compose `env_file`) | Send password-reset mail |
| `RESEND_FROM` | same — quote it: `"Selene <onboarding@resend.dev>"` | Sender (verify a domain for real users) |
| `APP_PUBLIC_URL` | same | Base URL for reset links (no trailing slash) |
| `TOTP_ISSUER` | same | Label in authenticator apps (`Selene`) |

**Important:** Do not put empty `RESEND_API_KEY=` in Compose `environment:` overrides. Empty host/root values **overwrite** `apps/backend/.env` and silence mail. Verify inside the container:

```bash
sudo docker exec selene-backend printenv RESEND_API_KEY | head -c 8   # should show re_…
sudo docker logs selene-backend 2>&1 | grep -i mail | tail -20
```

**Resend free / test mode:** with `onboarding@resend.dev` you can usually only email the address on your Resend account until you verify a custom domain.

---

## Local MacBook

### 1. Infra only (recommended for day-to-day)

```bash
cd /path/to/selene
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps
```

| Service | Host port |
|---------|-----------|
| Postgres | **5434** |
| Timescale | **5433** |
| EMQX MQTT | **1883** |
| EMQX dashboard | **18083** |

### 2. App processes (outside Docker)

```bash
cp apps/backend/.env.local.example apps/backend/.env
cp apps/frontend/.env.local.example apps/frontend/.env
# Ensure DATABASE_URL uses 127.0.0.1:5434, TIMESCALE 5433

bun install
cd apps/backend && bun run db:generate && bun run dev   # :8787
cd apps/frontend && bun run dev                         # :5173
```

### 3. Optional: live ESP32 data from VPS MQTT

```bash
./scripts/mqtt-tunnel.sh
# apps/backend/.env → MQTT_HOST=127.0.0.1 MQTT_PORT=1884
```

Or use local EMQX (`MQTT_PORT=1883`) and publish test messages yourself.

---

## Modular / microservices status

| Stage | Reality today |
|-------|----------------|
| **Modular monorepo** | **Yes** — `@selene/shared`, `@selene/sensors`, domain packages |
| **Parser registry** | **Yes** — energy (PZEM) + climate (DHT11) |
| **Production deploy** | **Modular compose on the VPS** — Caddy → monolith :8787 bridge serves the full API today |
| **Implemented services** | **Auth :3009** (full v1: JWT v2 EdDSA, 2FA, refresh rotation, admin, notifications, glossary) · Analytics :3006, Energy :3002, Climate :3003 (real TimescaleDB reads) · Ingestor :3005 Runnable |
| **Scaffolds** | Firmware :3004 |
| **Gateway cutover** | Pending — enable per-domain routes in `deploy/Caddyfile.modular` above the monolith bridge (auth first) |

So: **microservice-ready, monolith-bridged**, migrating service-by-service behind
the Caddy v1 gateway. See [CHANGELOG Unreleased](../CHANGELOG.md) for the cutover plan.

---

## Dynamic dashboard (discussion)

**Today:** cards, charts, and analytics routes are **code-defined** (React pages). Adding a new sensor means:

1. Parser in `@selene/sensors`  
2. Storage / API  
3. UI components for that domain  

**Possible later (not built):** capability-driven UI — backend exposes `/api/sensors/catalog` + per-capability widgets; frontend renders cards from registry. That is a product decision (more flexible, more abstract). Fixed pages are normal and fine for a known fleet (energy + climate).

---

## Edge firmware

Not in Selene.  
[Eco-Office `feat/selene-mqtt-ota`](https://github.com/dankehidayat/Eco-Office/blob/feat/selene-mqtt-ota/Eco%20Office.ino) → root **`Eco Office.ino`**.
