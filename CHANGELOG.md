# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **From/To time-range filter** — the preset range selector was replaced with a
  real date/time filter on the analytics pages (energy, environment, fuzzy, and
  climate-fuzzy tabs) and the dashboard. From/To pickers with time selectors
  when both dates match; defaults to the last 24 hours. All analytics, readings
  history, energy-history, and export endpoints accept optional `from` and `to`
  query parameters (RFC 3339) that override the preset `range`; span is capped
  at 2 years and `from < to` is enforced (HTTP 400 otherwise).
- **`getExportDataInRange`** — `/api/readings/export` now accepts `from`/`to`
  and streams only the selected window instead of the full hypertable.
- **OpenAPI contract** — `docs/openapi-v1.yml` renamed to `docs/openapi.yml`;
  `from`/`to` query parameters documented on analytics and export endpoints.
- **Docs restructure** — `docs/` reorganized into numbered reference/runbook
  documents (`01-ARCHITECTURE` … `08-LOCAL-DEVELOPMENT`); README rewritten as a
  pure documentation entry point.

### Fixed
- **1h / 24h analytics crash** — empty time windows returned a legacy
  `{ error: "No data in range" }` object which the frontend crashed on
  (`Cannot read properties of undefined (reading 'from')`). Summary and climate
  endpoints now return complete zero-filled shapes with a `timeSpan` for empty
  windows; climate returns a full empty climate shape instead of an error.
- **Degree-hours gap inflation** — the climate `degreeHours` accumulation had no
  inter-sample gap cap, so ranges spanning offline periods (e.g. the 2026-04-30
  → 2026-07-09 gap) inflated cooling/heating degree-hours. Now capped like the
  energy path (`Math.min(dt, 5/60)`).
- **EMQX crash-loop (bootstrap file)** — the EMQX node crashed in a 43s restart
  loop because `EMQX_API_KEY__BOOTSTRAP_FILE` pointed at
  `/opt/emqx/etc/default_api_key.conf`, which the production compose never
  mounted. The bootstrap-API-key mechanism was removed entirely: no
  `emqx-api-key.conf`, no `emqx-init` one-shot service, no bootstrap env vars.
  Dashboard and MQTT device credentials persist in the `emqx_data` volume.
- **Compose unification** — `docker-compose.modular.yml` was rewritten to read
  all credentials from the root `.env` (no hardcoded values), share the same
  named volumes as `docker-compose.yml` (`postgres_data`, `timescale_data`,
  `emqx_data`, `emqx_log`), and align container names. Infra containers no
  longer use `env_file` (the vector that injected the bootstrap var). The
  obsolete `scripts/deploy.sh` was deleted; deployment is a plain
  `docker compose -f docker-compose.modular.yml up -d --build`.

### Planned
- **Auth microservice cutover** — route `/api/v1/auth/*`, `/api/v1/me*`,
  `/api/v1/admin/*`, `/api/v1/notifications/*`, `/api/v1/glossary/*` in
  `deploy/Caddyfile.modular` above the monolith bridge so `services/auth` (:3009)
  serves identity traffic directly. The service is fully implemented; only the
  gateway route is pending.
- **Energy / Climate microservice cutover** — `services/energy` (:3002) and
  `services/climate` (:3003) query real TimescaleDB readings; wire their routes
  when confidence is high enough to move off the monolith.
- **`node_id` column** in `sensor_readings` so future node-scoped queries per
  domain service work.

## [1.0.0] — 2026-08-09

First tagged release: the working deployment. The production API is served by
the **monolith** `apps/backend` (:8787) behind a Caddy gateway that exposes the
`/api/v1/*` REST contract; the microservice fleet is scaffolded and partially
implemented behind the same gateway.

### Added

- **OpenAPI v1 contract** — `docs/openapi-v1.yml` is the single source of truth
  for the versioned `api/v1` API the web and mobile clients target.
- **Real auth microservice** — `services/auth` (:3009): register/login with 2FA,
  refresh-token rotation + reuse detection, profile management, admin user
  elevation, notifications, glossary, JWKS. Uses **JWT v2 (EdDSA Ed25519)**
  short-lived access tokens (15 min) + rotating refresh tokens (30 d).
- **Shared JWT v2 helpers** — `packages/shared/src/jwt/v2.ts` with DER→PEM
  normalization, JWKS output, and a smoke test.
- **Real TimescaleDB querying in energy/climate services** — `services/energy`
  (:3002) and `services/climate` (:3003) read `sensor_readings` directly.
- **Analytics service** — `services/analytics` (:3006) with stats, decision
  surface, box-plot, and Bland-Altman surfaces reading the real hypertable.
- **Caddy modular gateway** — `deploy/Caddyfile.modular` routes SPA → :3000,
  `/api/v1/*` and `/api/*` → monolith :8787, EMQX dashboard on its own host.

### Fixed

- **Frontend port alignment** — Caddy proxies the SPA to :3000 (publish) instead
  of the dev :4173/:5173 preview port; env examples and deployment docs updated.
- **EMQX dashboard 404** — removed the forced `/dashboard/login` rewrite that
  broke static assets; EMQX now redirects to its own dashboard.
- **EMQX bootstrap** — `emqx-init` provisions the dashboard user/password from
  `.env` (`EMQX_BOOTSTRAP_SECRET`) instead of hardcoded defaults, matching
  `deploy/emqx-api-key.conf`.
- **Prisma reliability** — monolith runs `prisma generate` + `prisma db push` at image build time (bundled Prisma v6 binary), removing runtime CLI resolution failures.
- **Swagger reachable** — `/docs` routes to the monolith's Swagger UI (was a 404).
- **Energy/climate data** — services query the real `sensor_readings`
  TimescaleDB table (was scaffolding against nothing).

### Known drift (documented)

- Shared `insertSensorReading` writes 13/17 columns; `current_per_kw`,
  `power_quality_score`, `energy_cost`, `voltage_stability` are not yet synced
  to the monolith's 17-column insert.
- Standalone `services/ingestor` and the monolith MQTT client both subscribe to
  the same topic — dedupe is currently `ON CONFLICT DO NOTHING`.

## [0.2.0] — 2026-07-10

Initial project bootstrap.

### Added

- Bun **monorepo workspace** (`apps`, `packages`, `services`) with shared
  TypeScript, MQTT, and timescale helpers.
- Monolith Fastify API `apps/backend` (:8787) — auth, analytics, readings,
  MQTT ingestion, OTA firmware, glossary, notifications.
- React SPA `apps/frontend` — dashboard, analytics, authentication.
- EMQX broker, PostgreSQL, TimescaleDB, Caddy deployment on the VPS.

[Unreleased]: https://github.com/dankehidayat/selene/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/dankehidayat/selene/releases/tag/v1.0.0
[0.2.0]: https://github.com/dankehidayat/selene/compare/v0.1.0...v1.0.0