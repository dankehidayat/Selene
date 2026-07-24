# @selene/frontend

React SPA for the Selene Smart Energy & Climate Dashboard.

## Stack

- React 18 + TypeScript  
- Vite  
- TanStack Router / Query  
- Tailwind CSS  
- Recharts + Observable Plot  

## Local development

```bash
# from monorepo root
bun install
cp apps/frontend/.env.local.example apps/frontend/.env
# VITE_API_BASE_URL=/api  → Vite proxies to backend :8787

cd apps/frontend
bun run dev
# http://127.0.0.1:5173
```

Backend must be running (`bun run dev:backend` or Docker).

## Production

Built into Docker (`apps/frontend/Dockerfile`).  
`VITE_API_BASE_URL` is injected at **image build** time from compose (e.g. `https://selene.dankehidayat.my.id/api`).

After UI changes on the VPS:

```bash
docker compose build frontend --no-cache
docker compose up -d frontend
```

## Main routes

| Path | Page |
|------|------|
| `/` | Dashboard |
| `/analytics` | Energy / climate / fuzzy analytics |
| `/data-log` | Historical table + export |
| `/glossary` | Terms |
| `/admin` | Admin tools (users, **firmware OTA**, system) — `ADMIN` role |
| `/login`, `/register` | Auth |

## Edge firmware

Device firmware is **not** stored in Selene. Use:

**https://github.com/dankehidayat/Eco-Office/tree/feat/selene-mqtt-ota**  
→ `Energy_Monitor/` (ESP32 DevKit V1, MQTT + OTA)

Admin **Firmware** tab uploads a compiled `.bin` and triggers MQTT OTA; the sketch must implement `command: "ota"` (see Eco-Office README on that branch).

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview build |
| `bun run typecheck` | `tsc --noEmit` |

## Related docs

- [Root README](../../README.md)  
- [Modular microservices](../../docs/MODULAR_MICROSERVICES.md)  
