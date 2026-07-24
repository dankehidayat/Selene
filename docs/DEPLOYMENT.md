# Selene — which Docker Compose / env files to use

## Quick answer

| Machine | Compose file | Command | Env files |
|---------|--------------|---------|-----------|
| **VPS (production)** | `docker-compose.yml` | `sudo docker compose up -d --build` | `.env` + `apps/backend/.env` (+ frontend build arg from root `.env`) |
| **Mac local (dev)** | `docker-compose.local.yml` | `docker compose -f docker-compose.local.yml up -d` | `apps/backend/.env` from `.env.local.example`; infra passwords are in the compose file |
| **Optional multi-service experiment** | `docker-compose.modular.yml` | **Do not use on VPS yet** | Future microservices only |

`docker-compose.production.yml` is a **duplicate** of `docker-compose.yml` for explicit naming. On the VPS, plain `docker compose …` is enough.

---

## File naming map

### Compose

| File | Audience |
|------|----------|
| **`docker-compose.yml`** | **Production / VPS default** |
| **`docker-compose.production.yml`** | Same as above (alias) |
| **`docker-compose.local.yml`** | **Local Mac** — Postgres on **5434**, Timescale **5433**, EMQX open ports |
| **`docker-compose.modular.yml`** | Scaffold for future split services (not production) |

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
git pull   # e.g. feat/modular-microservices

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

sudo docker compose up -d --build
# same as: sudo docker compose -f docker-compose.yml up -d --build

# Apply Prisma schema (password reset tokens + 2FA columns)
sudo docker exec selene-backend bunx prisma generate
sudo docker exec selene-backend bunx prisma db push
sudo docker logs -f selene-backend
```

Caddy on the host still proxies:

- `/api/*`, `/docs*`, `/health` → `localhost:8787`
- SPA → `localhost:4173`

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
| **Production deploy** | **Still one monolith** `apps/backend` + frontend image |
| **Many containers (auth/energy/…)** | **Scaffolded only** — not required for VPS |
| **Final multi-service stage** | Designed for later; Caddy modular file is future |

So: **microservice-friendly architecture**, **not** fully split in production yet.

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
