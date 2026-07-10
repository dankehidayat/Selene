# Selene

Smart Energy & Climate Dashboard

A real-time monitoring and analytics platform for ESP32-based IoT sensors. Built with React, TypeScript, Fastify, and PostgreSQL.

## Overview

Selene provides live dashboards, historical data logging, and advanced analytics for electrical parameters (voltage, current, power, power factor, frequency) and environmental conditions (temperature, humidity). The system implements a 15-rule Mamdani fuzzy inference engine for energy consumption classification and includes statistical tools such as Bland-Altman analysis, box plots, decision surface visualization, and membership function charts.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│   ESP32     │────▶│  Blynk IoT   │────▶│  Fastify    │────▶│  PostgreSQL │
│  PZEM-004T  │     │  Server      │     │  (Bun)      │     │            │
│  DHT11      │     └──────────────┘     └─────┬──────┘     └──────────┘
└─────────────┘                                │
                                               ▼
                                        ┌──────────────┐
                                        │  React SPA   │
                                        │  (Vite)      │
                                        └──────────────┘
```

- **ESP32** reads PZEM-004T (AC measurements) and DHT11 (temperature/humidity) and pushes to Blynk IoT server every 3 seconds.
- **Fastify backend** fetches data from Google Sheets CSV export every 30 seconds, caches it in memory, and serves REST API endpoints. Authentication uses JWT with bcrypt password hashing.
- **React frontend** renders dashboards using Recharts and Observable Plot. TanStack Router handles client-side routing with route guards for authenticated pages.

## Project Structure

```
selene/
├── apps/
│   ├── frontend/          # React + Vite + Tailwind CSS
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── pages/        # Route-level page components
│   │   │   ├── services/     # API hooks, auth context
│   │   │   └── types/        # TypeScript interfaces
│   │   └── ...
│   └── backend/           # Fastify + Prisma
│       ├── src/
│       │   ├── routes/       # auth, glossary, readings
│       │   ├── analytics/    # fuzzy logic, statistical helpers
│       │   └── index.ts      # server entry point
│       ├── prisma/
│       │   └── schema.prisma
│       └── ...
└── package.json           # workspace root
```

## Features

### Real-Time Dashboard

- AC voltage, current, power, temperature, and humidity readouts
- Power quality panel with composite score, cos φ, frequency
- Energy consumption and power usage analytics with range selectors (1h to 1y)
- Data refreshes every 3 seconds from Blynk IoT server

### Data Log

- Paginated table view of historical sensor readings
- Client-side sorting by timestamp (ascending/descending)
- Export to CSV or TSV format
- Page jump and page size selection (10, 20, 30, 50, 100 rows)

### Analytics

- **Energy**: Power distribution charts, peak usage hours, statistical summaries (mean, median, standard deviation, min/max)
- **Environment**: Hourly climate patterns, comfort distribution, dew point calculation, temperature-humidity correlation
- **Fuzzy Analysis**: Pie chart distribution, Power vs Power Factor scatter plot, membership function visualizations, box plot, Bland-Altman analysis, decision surface

### Authentication

- Email/password registration and login
- JWT-based authentication with 7-day token expiry
- Route protection via `ProtectedRoute` component
- Account management: update display name, change email, change password
- Delete account with confirmation input and password verification
- Login history tracking with IP and user agent

### Glossary

- Persistent technical terms and definitions stored in PostgreSQL
- Search, add, and delete functionality
- Default terms covering Electrical, Computing, Hardware, Statistics, and Climate categories

### Theme Support

- Light, dark, and system theme modes
- Theme preference persisted in localStorage
- Accessible from the account dropdown menu in the sidebar

## Technology Stack

### Frontend

- React 18 with TypeScript
- TanStack Router for type-safe client-side routing
- TanStack Query for server state management and caching
- Recharts for bar, line, and pie charts
- Observable Plot for statistical visualizations (box plot, scatter, Bland-Altman, decision surface)
- Radix UI primitives (Dialog, DropdownMenu, Popover, ScrollArea, Separator, Tooltip, HoverCard)
- Tailwind CSS with class-based dark mode
- Lucide React for iconography
- html2canvas for chart export to PNG

### Backend

- Fastify running on Bun runtime
- Prisma ORM with PostgreSQL
- bcryptjs for password hashing (12 rounds)
- jsonwebtoken for JWT signing and verification
- Google Sheets CSV parsing for data ingestion

## Getting Started

### Prerequisites

- Bun 1.3 or later
- PostgreSQL 16
- Node.js 22 or later (optional)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd selene

# Install dependencies
bun install

# Set up environment variables
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Edit apps/backend/.env with your configuration
# DATABASE_URL, JWT_SECRET, SHEET_CSV_URL, PORT

# Generate Prisma client and run migrations
cd apps/backend
bun run db:generate
bun run db:migrate
cd ../..

# Start development servers
bun run dev
```

### Environment Variables

#### Backend (`apps/backend/.env`)

| Variable        | Description                  |
| --------------- | ---------------------------- |
| `DATABASE_URL`  | PostgreSQL connection string |
| `JWT_SECRET`    | Secret key for JWT signing   |
| `SHEET_CSV_URL` | Google Sheets CSV export URL |
| `PORT`          | Server port (default: 8787)  |

#### Frontend (`apps/frontend/.env`)

| Variable                | Description                |
| ----------------------- | -------------------------- |
| `VITE_API_BASE_URL`     | Backend API URL            |
| `VITE_BLYNK_SERVER_URL` | Blynk IoT server URL       |
| `VITE_BLYNK_AUTH_TOKEN` | Blynk authentication token |

## API Endpoints

### Authentication

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/change-email` - Change email
- `DELETE /api/auth/delete-account` - Delete account
- `GET /api/auth/login-history` - Login history

### Readings

- `GET /api/readings/latest` - Latest sensor reading
- `GET /api/readings/history?range=24h` - Aggregated historical data
- `GET /api/readings/logs?pageSize=20` - Recent readings
- `GET /api/readings/export?format=csv` - Export data

### Analytics

- `GET /api/analytics/summary?range=7d` - Statistical summary
- `GET /api/analytics/climate?range=7d` - Climate analytics
- `GET /api/analytics/fuzzy-distribution?range=7d` - Fuzzy classification
- `GET /api/analytics/membership` - Membership function data
- `GET /api/analytics/decision-surface` - Decision surface data
- `GET /api/analytics/box-plot?range=7d` - Box plot data
- `GET /api/analytics/bland-altman?range=7d` - Bland-Altman data

### Glossary

- `GET /api/glossary` - List all terms
- `POST /api/glossary` - Create term
- `DELETE /api/glossary/:id` - Delete term

## Fuzzy Energy Classification

The system uses a 15-rule Mamdani fuzzy inference engine with four input variables:

1. **Voltage** - Low (<210V), Normal (205-235V), High (>230V)
2. **Power** - Economical (<30W), Normal (25-70W), Wasteful (>60W)
3. **Power Factor** - Poor (<0.6), Fair (0.55-0.85), Good (>0.8)
4. **Reactive Power** - Low (<25VAR), Medium (20-55VAR), High (>45VAR)

Output categories: ECONOMICAL, NORMAL, WASTEFUL.

The fuzzy logic is implemented identically in both the Arduino firmware (C++) and the backend analytics module (TypeScript), ensuring consistent classification between hardware and software.

## Deployment

```bash
# Build frontend
cd apps/frontend
bun run build

# Build backend
cd apps/backend
bun run build

# Start production server
cd apps/backend
bun run start
```

The frontend build output is in `apps/frontend/dist/`. Serve it with any static file server or configure the backend to serve it directly.

## License

This project is created by Danke Hidayat, Sekolah Vokasi IPB University, Jurusan Teknologi Rekayasa Komputer (TRK), Angkatan 58.

## Acknowledgments

Selene makes use of open-source libraries and tools. A complete list with versions and licenses is available on the Impressum page within the application.

```

```
