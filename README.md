# Selene

Smart Energy & Climate Dashboard

A real-time monitoring and analytics platform for ESP32-based IoT sensors. Built with React, TypeScript, Fastify, PostgreSQL, and TimescaleDB.

## Overview

Selene provides live dashboards, historical data logging, and advanced analytics for electrical parameters (voltage, current, power, power factor, frequency) and environmental conditions (temperature, humidity). The system implements a 15-rule Mamdani fuzzy inference engine for energy consumption classification and a 14-rule climate fuzzy engine for thermal comfort assessment. Statistical tools include Bland-Altman analysis, box plots, decision surface visualization, membership function charts, and ML-powered time-series forecasting.

## Architecture

```
ESP32 + PZEM-004T + DHT11
        |
        v
  Blynk IoT Server
        |
        v
  Fastify Backend (Bun)
        |
        v
  PostgreSQL (Users/Auth) + TimescaleDB (Sensor Readings)
        |
        v
  React Frontend
```

## Features

### Real-Time Dashboard

- AC voltage, current, power, temperature, and humidity readouts
- Power quality overview with composite score, cos phi, frequency, cost, and consumption
- Energy usage chart with power and current trends
- Climate history chart with temperature and humidity
- ML-powered 24-hour forecast with confidence bands for all metrics
- Adaptive forecast horizon based on selected range (1h to 1y)
- "Now" divider line separating actual data from predictions
- Data refreshes every 3 seconds via Blynk IoT proxy
- Automatic Blynk-to-TimescaleDB polling every 30 seconds

### Data Log

- Paginated table view of historical sensor readings from TimescaleDB
- Client-side sorting by timestamp (ascending/descending)
- Export to CSV or TSV format
- Page jump and page size selection (10, 20, 30, 50, 100 rows)

### Analytics

- **Energy**: Multi-line power chart (Power, Current, Apparent, Reactive), hourly usage pattern, energy consumption (Wh) with time-weighted integration
- **Environment**: Climate history with temperature and humidity, comfort distribution
- **Energy Fuzzy**: Pie charts, scatter plots, membership functions, box plots, Bland-Altman analysis, decision surface
- **Climate Fuzzy**: ASHRAE 55 & SNI 03-6572 based thermal comfort classification with scatter plots and distribution charts
- **ML Forecasting**: Linear regression + exponential smoothing + pattern matching ensemble model for all energy and climate charts
- Key metrics cards with statistical summaries

### Authentication & Authorization

- Email/password registration and login
- JWT-based authentication with 7-day token expiry
- Role-based access control (User / Admin)
- Admin panel for user management (role changes, disable/enable accounts, delete users)
- Login history tracking with session management

### Settings Overlay

- Modal overlay accessible from anywhere via the sidebar
- Profile management (name, email, password)
- Theme switching (light, dark, system) from both sidebar and settings
- Account deletion with confirmation flow
- Admin-only Administration tab for user management
- Logout accessible from settings sidebar

### Additional Features

- Glossary with search, add, and delete functionality
- Light, dark, and system theme modes with sidebar toggle
- Chart export to PNG and copy to clipboard
- Responsive sidebar navigation with mobile full-screen overlay
- Swagger/OpenAPI documentation at `/docs`
- Notification system for security events and system alerts

## Technology Stack

### Frontend

- React 18 with TypeScript
- TanStack Router for type-safe routing
- TanStack Query for server state management
- Recharts for interactive charts (ComposedChart, Line, Bar, Area, Pie)
- Observable Plot for statistical visualizations (scatter, box plot, Bland-Altman, decision surface)
- Radix UI primitives (Dialog, DropdownMenu, Popover, HoverCard, ScrollArea, Separator)
- Tailwind CSS with class-based dark mode
- Lucide React for iconography
- html2canvas for chart export
- Custom ML forecasting engine (Linear Regression + EMA + Pattern Matching)

### Backend

- Fastify running on Bun
- Prisma ORM with PostgreSQL (user accounts, glossary, notifications)
- TimescaleDB (sensor readings — hypertable with automatic time-based partitioning)
- @fastify/swagger + @fastify/swagger-ui for API documentation
- bcryptjs for password hashing (12 rounds)
- jsonwebtoken for JWT signing and verification
- Blynk IoT proxy for live sensor data with automatic TimescaleDB ingestion

### Hardware / edge firmware

- ESP32 DevKit V1, PZEM-004T, DHT11, LCD I2C  
- **Firmware lives in a separate repository** (not in Selene):  
  **[dankehidayat/Eco-Office](https://github.com/dankehidayat/Eco-Office)** branch **`feat/selene-mqtt-ota`** → [`Energy_Monitor/`](https://github.com/dankehidayat/Eco-Office/tree/feat/selene-mqtt-ota/Energy_Monitor)  
- Eco-Office **`main`** is reserved for the final report / original sketch — use `feat/selene-mqtt-ota` for Selene MQTT + OTA  
- Secrets in the sketch must stay blank in git; configure MQTT/Blynk locally before flash  

## Modular microservices architecture

Work continues on branch **`feat/modular-microservices`**.

| Layer | Role |
|-------|------|
| `@selene/shared` | Types, ports, Timescale helper, MQTT factory, JWT helpers |
| `@selene/sensors` | **PZEM-004T** + **DHT11** modules + **parser registry** |
| `services/ingestor` | Standalone MQTT → registry → Timescale (:3005) |
| `services/{auth,energy,climate,firmware}` | Domain scaffolds (:3001–3004) |
| `services/{soil,lux,…}` | Extension stubs |
| `apps/backend` | Transition monolith (full HTTP API :8787) |
| `apps/frontend` | Dashboard + Admin OTA UI |
| `deploy/Caddyfile.modular` | API gateway routes (future multi-service) |
| **Eco-Office** (external) | ESP32 firmware |

Canonical doc: **[docs/MODULAR_MICROSERVICES.md](./docs/MODULAR_MICROSERVICES.md)**  
Backend notes: **[apps/backend/README.md](./apps/backend/README.md)** · Frontend: **[apps/frontend/README.md](./apps/frontend/README.md)**

```bash
bun install
bun run test:sensors
bun run dev:backend      # monolith + ingest
bun run dev:frontend
bun run dev:ingestor     # optional standalone ingestor
curl -s localhost:8787/api/sensors/catalog
```


## Getting Started

### Prerequisites

- Bun 1.3 or later
- Docker Desktop (for PostgreSQL and TimescaleDB)
- PostgreSQL 16 (via Docker)
- TimescaleDB (via Docker)

### Local Development

```bash
git clone https://github.com/dankehidayat/selene.git
cd selene

# Start databases (PostgreSQL + TimescaleDB + EMQX)
# Postgres is published on host port 5434 (not 5432) to avoid clashing with
# Homebrew postgresql@14, which commonly owns localhost:5432 on macOS.
docker compose -f docker-compose.local.yml up -d

# Backend setup
cd apps/backend
cp .env.local.example .env
# DATABASE_URL must use 127.0.0.1:5434 — see note below
bun install
bun run db:generate
bun run db:migrate
bun run dev

# Frontend setup (new terminal)
cd apps/frontend
cp .env.local.example .env
bun install
bun run dev
```

The frontend will be available at `http://localhost:5173`, backend at `http://localhost:8787`, and Swagger UI at `http://localhost:8787/docs`.

**macOS note (Prisma P1010):** If Homebrew PostgreSQL is running, `localhost:5432` is the brew instance (databases like `flowpoint` / `matilda`), not Docker. Prisma then reports `P1010: User was denied access on the database (not available)` even though auth “works” against the wrong server. Use host port **5434** for Selene Postgres (`docker-compose.local.yml`) and point `DATABASE_URL` at `127.0.0.1:5434`.

### Live ESP32 data on Mac (no Arduino changes)

The ESP32 publishes only to the **VPS** broker. To feed the same stream into the local backend:

```text
ESP32 → VPS EMQX ←── SSH tunnel ── Mac backend → local Timescale → dashboard
```

1. Leave firmware as-is (`MQTT_BROKER` = VPS IP, user `selene` / `selene123`).
2. Open a tunnel (leave this terminal running; enter your SSH key passphrase if prompted):

```bash
./scripts/mqtt-tunnel.sh
# equivalent: ssh -N -L 1884:127.0.0.1:1883 rd
```

3. Backend `.env` (already documented in `apps/backend/.env.local.example`):

```env
MQTT_HOST=127.0.0.1
MQTT_PORT=1884
MQTT_USER=selene
MQTT_PASSWORD=selene123
MQTT_TOPIC=selene/+/telemetry
```

4. Start backend (`bun run dev` in `apps/backend`). You should see `[MQTT] Connected` and new rows when the device publishes.

If the tunnel fails, on the VPS check that EMQX is listening on host port 1883 (`ss -lntp | grep 1883`). Adjust `REMOTE_MQTT` if needed: `REMOTE_MQTT=127.0.0.1:1883 ./scripts/mqtt-tunnel.sh`.

### Docker Deployment (production / VPS)

Matches the live VPS layout (`docker-compose.yml` + root `.env` + `apps/backend/.env`).

Production uses the **monolith backend** plus Postgres, Timescale, and EMQX. Modular packages (`@selene/shared`, `@selene/sensors`) are **built into** the backend image — you do **not** need separate microservices on the VPS yet.

```bash
# On the VPS (repo root) — keep existing secrets; only create if missing
cp -n .env.example .env
cp -n apps/backend/.env.example apps/backend/.env
cp -n apps/frontend/.env.example apps/frontend/.env
# Edit .env / apps/backend/.env with the SAME passwords already on the server

docker compose build backend
docker compose up -d
docker exec selene-backend bunx prisma generate
```

| File on VPS | Purpose |
|-------------|---------|
| `.env` | Compose + Postgres/Timescale/EMQX/MQTT/JWT/ports |
| `apps/backend/.env` | Backend process env (compose overrides DB/MQTT URLs) |
| `apps/frontend/.env` | Documents `VITE_API_BASE_URL` (also set via compose build arg) |

**Production MQTT:** `MQTT_HOST=emqx`, `MQTT_USER=selene`, topic `selene/+/telemetry`. ESP32 keeps publishing to the VPS public IP:1883.

**Do not** use `docker-compose.modular.yml` on the VPS until a full service split. Local Mac: `docker-compose.local.yml` + optional `./scripts/mqtt-tunnel.sh`.

### Data Import (one-time)

If migrating from Google Sheets, export your data as CSV and import into TimescaleDB:

```bash
# Copy CSV to container
docker cp sensor_readings.csv selene-timescaledb:/tmp/

# Import
docker exec selene-timescaledb psql -U selene_ts -d selene_measurements -c "\COPY sensor_readings FROM '/tmp/sensor_readings.csv' CSV HEADER;"

# Verify
docker exec selene-timescaledb psql -U selene_ts -d selene_measurements -c "SELECT COUNT(*) FROM sensor_readings;"
```

### First Admin Setup

New users are created with the `USER` role by default. To grant admin privileges to your account:

**Option 1 — Via CLI (local development):**

```bash
cd apps/backend
bun --env-file=.env -e "
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
await prisma.user.update({ where: { email: 'your-email@example.com' }, data: { role: 'ADMIN' } });
console.log('User promoted to ADMIN');
await prisma.\$disconnect();
"
```

**Option 2 — Via Docker:**

```bash
docker exec selene-backend bun -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.update({ where: { email: 'your-email@example.com' }, data: { role: 'ADMIN' } }).then(() => { console.log('Promoted to ADMIN'); prisma.\$disconnect(); });
"
```

**Option 3 — Via an existing Admin:**
An admin can promote other users through **Settings > Administration** in the application UI.

Admin users have access to:

- **User Management**: List, search, and filter all registered users
- **Role Management**: Promote users to Admin or demote to User
- **Account Status**: Enable or disable user accounts
- **User Deletion**: Permanently remove user accounts
- **System Statistics**: View total users, active users, and admin counts

## Environment Variables

### Root `.env`

| Variable            | Description                   | Example                                                       |
| ------------------- | ----------------------------- | ------------------------------------------------------------- |
| `JWT_SECRET`        | Secret key for JWT signing    | `openssl rand -base64 64`                                     |
| `DATABASE_URL`      | PostgreSQL connection string  | `postgresql://user:pass@postgres:5432/selene`                 |
| `TIMESCALE_URL`     | TimescaleDB connection string | `postgresql://user:pass@timescaledb:5432/selene_measurements` |
| `VITE_API_BASE_URL` | Frontend API URL              | `https://selene.dankehidayat.my.id/api`                       |
| `BLYNK_SERVER_URL`  | Blynk IoT server URL          | `http://iot.serangkota.go.id:8080`                            |
| `BLYNK_AUTH_TOKEN`  | Blynk authentication token    | `your-blynk-token`                                            |

### Backend `.env`

| Variable           | Description                   | Example                                                              |
| ------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `PORT`             | Server port                   | `8787`                                                               |
| `JWT_SECRET`       | Secret key for JWT signing    | `openssl rand -base64 64`                                            |
| `DATABASE_URL`     | PostgreSQL connection string  | `postgresql://selene_admin:local_dev_password@127.0.0.1:5434/selene`  |
| `TIMESCALE_URL`    | TimescaleDB connection string | `postgresql://selene_ts:local_dev_password@127.0.0.1:5433/selene_measurements` |
| `BLYNK_SERVER_URL` | Blynk IoT server URL          | `http://iot.serangkota.go.id:8080`                                   |
| `BLYNK_AUTH_TOKEN` | Blynk authentication token    | `your-blynk-token`                                                   |

### Frontend `.env`

| Variable            | Description     | Example                     |
| ------------------- | --------------- | --------------------------- |
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8787/api` |

## API Endpoints

### Authentication

| Method | Path                        | Description        | Auth |
| ------ | --------------------------- | ------------------ | ---- |
| POST   | `/api/auth/register`        | Create account     | No   |
| POST   | `/api/auth/login`           | Sign in            | No   |
| GET    | `/api/auth/me`              | Get current user   | Yes  |
| PATCH  | `/api/auth/me`              | Update profile     | Yes  |
| POST   | `/api/auth/change-password` | Change password    | Yes  |
| POST   | `/api/auth/change-email`    | Change email       | Yes  |
| DELETE | `/api/auth/delete-account`  | Delete account     | Yes  |
| GET    | `/api/auth/login-history`   | Login history      | Yes  |
| DELETE | `/api/auth/clear-sessions`  | Clear all sessions | Yes  |

### Admin

| Method | Path                                 | Description         | Auth  |
| ------ | ------------------------------------ | ------------------- | ----- |
| GET    | `/api/admin/users`                   | List all users      | Admin |
| GET    | `/api/admin/users/:id`               | Get user details    | Admin |
| PATCH  | `/api/admin/users/:id/role`          | Change user role    | Admin |
| PATCH  | `/api/admin/users/:id/toggle-active` | Enable/disable user | Admin |
| DELETE | `/api/admin/users/:id`               | Delete user         | Admin |
| GET    | `/api/admin/stats`                   | System statistics   | Admin |

### Readings

| Method | Path                                         | Description                | Auth |
| ------ | -------------------------------------------- | -------------------------- | ---- |
| GET    | `/api/readings/latest`                       | Latest sensor reading      | No   |
| GET    | `/api/readings/history?range=24h`            | Aggregated historical data | No   |
| GET    | `/api/readings/history?range=7d&type=energy` | Energy consumption data    | No   |
| GET    | `/api/readings/logs?pageSize=20`             | Recent readings            | No   |
| GET    | `/api/readings/export?format=csv`            | Export data                | No   |

### Analytics

| Method | Path                                                 | Description                  | Auth |
| ------ | ---------------------------------------------------- | ---------------------------- | ---- |
| GET    | `/api/analytics/summary?range=7d`                    | Statistical summary          | No   |
| GET    | `/api/analytics/climate?range=7d`                    | Climate analytics            | No   |
| GET    | `/api/analytics/fuzzy-distribution?range=7d`         | Energy fuzzy classification  | No   |
| GET    | `/api/analytics/climate-fuzzy-distribution?range=7d` | Climate fuzzy classification | No   |
| GET    | `/api/analytics/membership`                          | Membership function data     | No   |
| GET    | `/api/analytics/decision-surface`                    | Decision surface data        | No   |
| GET    | `/api/analytics/box-plot?range=7d`                   | Box plot data                | No   |
| GET    | `/api/analytics/bland-altman?range=7d`               | Bland-Altman data            | No   |

### Blynk Proxy

| Method | Path              | Description             | Auth |
| ------ | ----------------- | ----------------------- | ---- |
| GET    | `/api/blynk/:pin` | Proxy Blynk sensor data | No   |

### Notifications

| Method | Path                          | Description              | Auth |
| ------ | ----------------------------- | ------------------------ | ---- |
| GET    | `/api/notifications`          | Get user notifications   | Yes  |
| PATCH  | `/api/notifications/:id/read` | Mark as read             | Yes  |
| PATCH  | `/api/notifications/read-all` | Mark all as read         | Yes  |
| DELETE | `/api/notifications`          | Delete all notifications | Yes  |

### Glossary

| Method | Path                | Description    | Auth |
| ------ | ------------------- | -------------- | ---- |
| GET    | `/api/glossary`     | List all terms | No   |
| POST   | `/api/glossary`     | Create term    | No   |
| DELETE | `/api/glossary/:id` | Delete term    | No   |

### Health

| Method | Path      | Description  | Auth |
| ------ | --------- | ------------ | ---- |
| GET    | `/health` | Health check | No   |

## Database Architecture

| Database    | Purpose                                      | Technology                         |
| ----------- | -------------------------------------------- | ---------------------------------- |
| PostgreSQL  | User accounts, auth, glossary, notifications | Standard PostgreSQL                |
| TimescaleDB | Sensor readings (time-series data)           | PostgreSQL + TimescaleDB extension |

Sensor readings are stored in a TimescaleDB hypertable (`sensor_readings`), automatically partitioned into 7-day chunks. Queries use `time_bucket()` for efficient time-based aggregation. Live data from Blynk is automatically polled every 30 seconds and inserted into TimescaleDB.

## ML Forecasting

The dashboard includes a lightweight machine learning forecasting engine that runs entirely in the browser:

- **Linear Regression with Gradient Descent**: Learns trend from recent data
- **Exponential Moving Average with Trend Detection**: Smooths noise and detects direction
- **Hourly Pattern Matching**: Extracts average patterns by hour of day from all history
- **Ensemble Method**: Dynamically weights methods based on horizon length

Forecast horizons adapt to the selected range:
| Range | Forecast Points | Interval |
|-------|----------------|----------|
| 1 Hour | 12 points | 5 minutes |
| 24 Hours | 24 points | 1 hour |
| 7 Days | 48 points | 1 hour |
| 30 Days | 30 points | 1 day |
| 3 Months | 12 points | 1 week |
| 6 Months | 12 points | 2 weeks |
| 1 Year | 12 points | 1 month |

All computation runs client-side in under 10ms with zero additional dependencies.

## Fuzzy Energy Classification

The system uses a 15-rule Mamdani fuzzy inference engine with four input variables:

1. **Voltage** - Low (<210V), Normal (205-235V), High (>230V)
2. **Power** - Economical (<30W), Normal (25-70W), Wasteful (>60W)
3. **Power Factor** - Poor (<0.6), Fair (0.55-0.85), Good (>0.8)
4. **Reactive Power** - Low (<25VAR), Medium (20-55VAR), High (>45VAR)

Output categories: **ECONOMICAL**, **NORMAL**, **WASTEFUL**.

## Climate Fuzzy Classification

Based on ASHRAE Standard 55-2020 and SNI 03-6572-2001, adapted for naturally ventilated buildings in tropical climates. Uses a 14-rule Mamdani fuzzy inference engine with two input variables:

1. **Temperature** - Cold (<22°C), Cool (22-25°C), Comfortable (24-28°C), Warm (27-31°C), Hot (>30°C)
2. **Humidity** - Dry (<55%), Comfortable (50-72%), Humid (>68%)

Output categories: **COLD**, **COOL**, **COMFORTABLE**, **WARM**, **HOT**.

The fuzzy logic is implemented identically in both the Arduino firmware (C++) and the backend analytics module (TypeScript).

## Project Structure

```
selene/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components, overlays
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── services/     # API hooks, auth context
│   │   │   ├── lib/          # Utility functions, ML forecasting
│   │   │   └── types/        # TypeScript interfaces
│   │   ├── Dockerfile
│   │   ├── serve.ts          # Production server
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── routes/       # Auth, admin, glossary, notifications
│       │   ├── middleware/   # Auth guards (authenticate, requireAdmin)
│       │   ├── analytics/    # Fuzzy logic, statistics
│       │   ├── timescale.ts  # TimescaleDB client
│       │   └── index.ts      # Server entry point
│       ├── prisma/
│       │   └── schema.prisma
│       └── Dockerfile
├── docker-compose.yml
├── Caddyfile                 # Reverse proxy config
└── .env.example
```

## Author

**Danke Hidayat**

- Email: dnk.hidayat@gmail.com
- LinkedIn: [linkedin.com/in/dankehidayat](https://www.linkedin.com/in/dankehidayat/)
- Bluesky: [bsky.app/profile/dankehidayat.my.id](https://bsky.app/profile/dankehidayat.my.id)
- GitHub: [github.com/dankehidayat/selene](https://github.com/dankehidayat/selene)

Vocational School of IPB University

Technology of Computer Engineering

## License

This project was developed as part of the final assignment (Tugas Akhir) at the Computer Engineering Technology program, College of Vocational Studies, IPB University.

## Acknowledgments

Selene makes use of open-source libraries and tools. A complete list with versions and licenses is available on the Impressum page within the application.
