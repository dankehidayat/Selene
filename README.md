# Selene

Smart Energy & Climate Dashboard

A real-time monitoring and analytics platform for ESP32-based IoT sensors. Built with React, TypeScript, Fastify, and PostgreSQL.

## Overview

Selene provides live dashboards, historical data logging, and advanced analytics for electrical parameters (voltage, current, power, power factor, frequency) and environmental conditions (temperature, humidity). The system implements a 15-rule Mamdani fuzzy inference engine for energy consumption classification and includes statistical tools such as Bland-Altman analysis, box plots, decision surface visualization, and membership function charts.

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
- **Fuzzy Analysis**: Pie charts, scatter plots, membership functions, box plots, Bland-Altman analysis, decision surface

### Authentication

- Email/password registration and login
- JWT-based authentication with 7-day token expiry
- Route protection and account management
- Login history tracking

### Additional Features

- Glossary with search, add, and delete functionality
- Light, dark, and system theme modes
- Chart export to PNG and copy to clipboard
- Responsive sidebar navigation

## Technology Stack

### Frontend

- React 18 with TypeScript
- TanStack Router for type-safe routing
- TanStack Query for server state management
- Recharts for bar, line, and pie charts
- Observable Plot for statistical visualizations
- Radix UI primitives (Dialog, DropdownMenu, Popover, HoverCard)
- Tailwind CSS with class-based dark mode
- Lucide React for iconography
- html2canvas for chart export

### Backend

- Fastify running on Bun
- Prisma ORM with PostgreSQL
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
```

The frontend will be available at `http://localhost:4173` and the backend at `http://localhost:8787`.

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

| Method | Path                        | Description      |
| ------ | --------------------------- | ---------------- |
| POST   | `/api/auth/register`        | Create account   |
| POST   | `/api/auth/login`           | Sign in          |
| GET    | `/api/auth/me`              | Get current user |
| PATCH  | `/api/auth/me`              | Update profile   |
| POST   | `/api/auth/change-password` | Change password  |
| POST   | `/api/auth/change-email`    | Change email     |
| DELETE | `/api/auth/delete-account`  | Delete account   |
| GET    | `/api/auth/login-history`   | Login history    |

### Readings

| Method | Path                              | Description                |
| ------ | --------------------------------- | -------------------------- |
| GET    | `/api/readings/latest`            | Latest sensor reading      |
| GET    | `/api/readings/history?range=24h` | Aggregated historical data |
| GET    | `/api/readings/logs?pageSize=20`  | Recent readings            |
| GET    | `/api/readings/export?format=csv` | Export data                |

### Analytics

| Method | Path                                         | Description              |
| ------ | -------------------------------------------- | ------------------------ |
| GET    | `/api/analytics/summary?range=7d`            | Statistical summary      |
| GET    | `/api/analytics/climate?range=7d`            | Climate analytics        |
| GET    | `/api/analytics/fuzzy-distribution?range=7d` | Fuzzy classification     |
| GET    | `/api/analytics/membership`                  | Membership function data |
| GET    | `/api/analytics/decision-surface`            | Decision surface data    |
| GET    | `/api/analytics/box-plot?range=7d`           | Box plot data            |
| GET    | `/api/analytics/bland-altman?range=7d`       | Bland-Altman data        |

### Blynk Proxy

| Method | Path              | Description             |
| ------ | ----------------- | ----------------------- |
| GET    | `/api/blynk/:pin` | Proxy Blynk sensor data |

### Glossary

| Method | Path                | Description    |
| ------ | ------------------- | -------------- |
| GET    | `/api/glossary`     | List all terms |
| POST   | `/api/glossary`     | Create term    |
| DELETE | `/api/glossary/:id` | Delete term    |

### Health

| Method | Path      | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |

## Fuzzy Energy Classification

The system uses a 15-rule Mamdani fuzzy inference engine with four input variables:

1. **Voltage** - Low (<210V), Normal (205-235V), High (>230V)
2. **Power** - Economical (<30W), Normal (25-70W), Wasteful (>60W)
3. **Power Factor** - Poor (<0.6), Fair (0.55-0.85), Good (>0.8)
4. **Reactive Power** - Low (<25VAR), Medium (20-55VAR), High (>45VAR)

Output categories: ECONOMICAL, NORMAL, WASTEFUL.

The fuzzy logic is implemented identically in both the Arduino firmware (C++) and the backend analytics module (TypeScript).

## Project Structure

```
selene/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── services/     # API hooks, auth context
│   │   │   └── types/        # TypeScript interfaces
│   │   ├── Dockerfile
│   │   ├── serve.ts          # Production server
│   │   └── package.json
│   └── backend/
│       ├── src/
│       │   ├── routes/       # Auth, glossary endpoints
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
