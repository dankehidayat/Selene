# Selene

Smart Energy & Climate Dashboard

A real-time monitoring and analytics platform for ESP32-based IoT sensors. Built with React, TypeScript, Fastify, and PostgreSQL.

## Overview

Selene provides live dashboards, historical data logging, and advanced analytics for electrical parameters (voltage, current, power, power factor, frequency) and environmental conditions (temperature, humidity). The system implements a 15-rule Mamdani fuzzy inference engine for energy consumption classification and a 14-rule climate fuzzy engine for thermal comfort assessment. Statistical tools include Bland-Altman analysis, box plots, decision surface visualization, and membership function charts.

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
  PostgreSQL + React Frontend
```

## Features

### Real-Time Dashboard

- AC voltage, current, power, temperature, and humidity readouts
- Power quality panel with composite score, cos phi, and frequency
- Energy consumption and power usage analytics with range selectors (1h to 1y)
- Data refreshes every 3 seconds via Blynk IoT proxy

### Data Log

- Paginated table view of historical sensor readings
- Client-side sorting by timestamp (ascending/descending)
- Export to CSV or TSV format
- Page jump and page size selection (10, 20, 30, 50, 100 rows)

### Analytics

- **Energy**: Power distribution charts, peak usage hours, statistical summaries
- **Environment**: Hourly climate patterns, comfort distribution, dew point, correlation
- **Energy Fuzzy**: Pie charts, scatter plots, membership functions, box plots, Bland-Altman analysis, decision surface
- **Climate Fuzzy**: ASHRAE 55 & SNI 03-6572 based thermal comfort classification with scatter plots and distribution charts

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
- Recharts for bar, line, and pie charts
- Observable Plot for statistical visualizations
- Radix UI primitives (Dialog, DropdownMenu, Popover, HoverCard, ScrollArea, Separator)
- Tailwind CSS with class-based dark mode
- Lucide React for iconography
- html2canvas for chart export

### Backend

- Fastify running on Bun
- Prisma ORM with PostgreSQL
- @fastify/swagger + @fastify/swagger-ui for API documentation
- bcryptjs for password hashing (12 rounds)
- jsonwebtoken for JWT signing and verification
- Google Sheets CSV parsing for data ingestion
- Blynk IoT proxy for live sensor data

### Hardware

- ESP32 microcontroller
- PZEM-004T AC measurement module
- DHT11 temperature and humidity sensor
- Arduino Framework
- Blynk IoT platform

## Getting Started

### Prerequisites

- Bun 1.3 or later
- PostgreSQL 16

### Local Development

```bash
git clone https://github.com/dankehidayat/selene.git
cd selene

# Backend setup
cp .env.example .env
# Edit .env with your configuration
cd apps/backend
bun install
bun run db:generate
bun run db:migrate
bun run dev

# Frontend setup (new terminal)
cd apps/frontend
cp .env.example .env
bun install
bun run dev
```

### Docker Deployment

```bash
cp .env.example .env
# Edit .env with your configuration
docker compose up -d
docker exec selene-backend bunx prisma db push
docker exec selene-backend bun run db:generate
```

The frontend will be available at `http://localhost:4173` and the backend at `http://localhost:8787`.

Swagger UI is available at `http://localhost:8787/docs`.

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

### Backend

| Variable           | Description                  | Example                                      |
| ------------------ | ---------------------------- | -------------------------------------------- |
| `PORT`             | Server port                  | `8787`                                       |
| `JWT_SECRET`       | Secret key for JWT signing   | `openssl rand -base64 64`                    |
| `SHEET_CSV_URL`    | Google Sheets CSV export URL | `https://docs.google.com/spreadsheets/d/...` |
| `DATABASE_URL`     | PostgreSQL connection string | `postgresql://user:pass@host:5432/selene`    |
| `BLYNK_SERVER_URL` | Blynk IoT server URL         | `http://iot.serangkota.go.id:8080`           |
| `BLYNK_AUTH_TOKEN` | Blynk authentication token   | `your-blynk-token`                           |

### Frontend

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

| Method | Path                              | Description                | Auth |
| ------ | --------------------------------- | -------------------------- | ---- |
| GET    | `/api/readings/latest`            | Latest sensor reading      | No   |
| GET    | `/api/readings/history?range=24h` | Aggregated historical data | No   |
| GET    | `/api/readings/logs?pageSize=20`  | Recent readings            | No   |
| GET    | `/api/readings/export?format=csv` | Export data                | No   |

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
│   │   │   ├── lib/          # Utility functions
│   │   │   └── types/        # TypeScript interfaces
│   │   ├── Dockerfile
│   │   ├── serve.ts          # Production server
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── routes/       # Auth, admin, glossary, notifications
│       │   ├── middleware/   # Auth guards (authenticate, requireAdmin)
│       │   ├── analytics/    # Fuzzy logic, statistics
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
