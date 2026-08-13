# Analytics Triage

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-14
**Status:** Published
**Type:** Runbook
**Target Environment:** Production

---

## Overview

The Selene analytics engine in `apps/backend` computes energy and climate statistics from TimescaleDB continuous aggregates. This runbook covers triage for the two known failure modes: **empty-range crash** (frontend shows `Cannot read properties of undefined`) and **energy/cost inflation** (totals quadruple despite modest data counts).

---

## Prerequisites & Access

- `sudo docker exec` access to `selene-backend` and `selene-timescaledb`

---

## Symptom: "Cannot read properties of undefined (reading from)" on 1h / 24h range

### What you see

Frontend Analytics page → Energy tab → select 1h or 24h → blank chart and error toast:

```
Cannot read properties of undefined (reading from)
```

7d, 30d, 3m, 6m, 1y work fine.

### Root cause

The analytics summary endpoint returns `{ error: 'No data in range' }` for empty ranges. The frontend attempts `new Date(summary.timeSpan.from)`, which crashes because `summary` is an error object, not a summary.

This happens for 1h / 24h when the device has been offline long enough that those windows contain zero data.

The fix was shipped in commit `d54f30f3` (2026-08-10): the backend now returns a well-formed empty summary shape for empty ranges, and the frontend guards `summary?.timeSpan` before rendering the period row.

### Resolution

**Update the running code** (if the deployed image predates Aug-10):

```bash
cd ~/Developer/Selene
git pull origin master
sudo docker compose -f docker-compose.modular.yml build backend frontend
sudo docker compose -f docker-compose.modular.yml up -d backend frontend
```

### Verification

```bash
# Test 1h range (may return empty data, should NOT crash)
curl -s "http://127.0.0.1:8787/api/analytics/summary?range=1h" | python3 -m json.tool
# Expect: { "timeSpan": { "from": "...", "to": "..." }, "power": { "avg": 0, ... }, ... }
# NOT: { "error": "No data in range" }
```

---

## Symptom: Energy / cost quadrupling

### What you see

- 7d range: Power avg ~5.88 W, Total Energy ~0.275 kWh, Est. Cost Rp 397 — looks correct
- 30d range: Power avg ~4.31 W, Total Energy ~2.013 kWh — slightly elevated but plausible
- Previously with ~14k data points: Total Energy and Est. Cost were ~4x expected

### Root cause

The `getCumulativeEnergyKwh()` function sums per-row delta of `total_energy` (a monotonic kWh counter from the PZEM-004T). It excludes "placeholder" rows where all numeric columns are zero (indicating an offline gap).

**Before commit `bbd36423`**, the exclusion logic failed — placeholder rows sneaked into the cumulative calculation. When the counter dropped from e.g. `63.967` to `0` (offline placeholder) then back to `64.002`, the delta logic saw `64.002 - 0 = 64.002` and added that full amount. With multiple offline blips over 14k rows, the total inflated ~4x.

The fix (commit `bbd36423`, 2026-08-10) properly excludes all-zero rows before computing cumulative energy.

### Resolution

**Update running code** (same as above — pull, build, up):

```bash
cd ~/Developer/Selene
git pull origin master
sudo docker compose -f docker-compose.modular.yml build backend
sudo docker compose -f docker-compose.modular.yml up -d backend
```

### Verification

Compare energy against the raw counter delta:

```bash
# Get first and last total_energy for the range
sudo docker exec selene-timescaledb psql -U selene_ts -d selene_measurements -c "
  SELECT MIN(time), MAX(time), 
         MIN(total_energy) FILTER (WHERE total_energy > 0) AS first_energy,
         MAX(total_energy) FILTER (WHERE total_energy > 0) AS last_energy,
         MAX(total_energy) FILTER (WHERE total_energy > 0) 
           - MIN(total_energy) FILTER (WHERE total_energy > 0) AS expected_kwh
  FROM sensor_readings 
  WHERE time >= NOW() - INTERVAL '30 days';
"

# Compare with API
curl -s "http://127.0.0.1:8787/api/analytics/summary?range=30d" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'API reports: {d[\"energy\"][\"totalKwh\"]} kWh')
print(f'Cost: {d[\"energy\"][\"estimatedCost\"]}')
"
```

Expected: API total ≈ expected_kwh (within margin for MQTT vs sheet overlap).

---

## Symptom: Climate degree-hours inflated on broad ranges (3m / 6m / 1y)

### Root cause

The climate endpoint computes cooling degree-hours as:

```
degreeHours += max(0, (T_i + T_{i-1}) / 2 - 18) * dt
```

Unlike the energy endpoint (which caps gaps at 5 minutes), the climate endpoint has **no gap cap** on `dt`. Ranges spanning the data gap (April 30 → July 9, 2026) accumulate degree-hours across the ~1680-hour gap, inflating totals by ~16k or more.

### Resolution

**Shipped.** The climate degree-hours loop now caps each `dt` with `Math.min(dt, 5/60)` — the same 5-minute gap cap the energy path uses — so data gaps (e.g. April 30 → July 9, 2026) no longer inflate cooling degree-hours. Deploy `apps/backend` from master to apply:

```bash
cd ~/Developer/Selene
git pull origin master
sudo docker compose -f docker-compose.modular.yml build backend
sudo docker compose -f docker-compose.modular.yml up -d backend
```

### Verification

```bash
curl -s "http://127.0.0.1:8787/api/analytics/climate?range=3m" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'degreeHours: {d[\"temperature\"][\"degreeHours\"]}')
# Expect a plausible total (tens–hundreds), NOT ~16k+ inflated by the 1680h gap
"
```

---

## Custom time range (From / To)

The analytics and readings endpoints accept a **preset `range`** (`1h`, `24h`, `7d`, `30d`, `3m`, `6m`, `1y`) OR a **custom window** via `from` and `to`:

| Param | Type | Meaning |
|---|---|---|
| `from` | RFC 3339 / ISO 8601 | Inclusive start. Overrides the preset `range` when both are provided. Defaults to 24 h before `to`. |
| `to` | RFC 3339 / ISO 8601 | Inclusive end. Defaults to now when omitted. Must be after `from`. |

Validation (in `apps/backend/src/index.ts` → `resolveTimeRange`): `from < to`, span capped at **2 years**; invalid windows return `400`. When neither `from`/`to` nor `range` is given, the window defaults to the last 24 hours.

Example:

```bash
curl -s "http://127.0.0.1:8787/api/analytics/summary?from=2026-08-05T00:00:00Z&to=2026-08-07T23:59:59Z" | python3 -m json.tool
```

Endpoints that accept `from`/`to`: `analytics/summary`, `analytics/climate`, `analytics/fuzzy-distribution`, `analytics/box-plot`, `analytics/bland-altman`, `analytics/climate-fuzzy-distribution`, `readings/history`, `readings/export` (export-by-range).

The **climate endpoint** now returns a well-formed empty shape for empty windows (all-zero stats, empty `comfortDistribution`/`hourlyData`) instead of `{ error: "No data in range" }` — matching the energy summary fix.

---

## Symptom: Export CSV shows rows from the future (2026 dates)

The database contains realistic data through 2026-08-12 (last sheet row). These are **not** future dates — the project's timeline is 2025-2026. The device has been logging since October 2025. No action needed.

---

## Diagnostic SQL reference

These queries can be run via `sudo docker exec -i selene-timescaledb psql -U selene_ts -d selene_measurements`.

### Row count by source period

```sql
SELECT DATE(time) AS day, COUNT(*) 
FROM sensor_readings 
GROUP BY day 
ORDER BY day;
```

### Detect duplicates (same timestamp, same node)

```sql
SELECT time, COUNT(*) 
FROM sensor_readings 
GROUP BY time 
HAVING COUNT(*) > 1;
```

### Data gap check

```sql
SELECT time FROM sensor_readings 
ORDER BY time;
-- Visually inspect for gaps > 1 hour between consecutive rows
```

### CAGG freshness

```sql
SELECT view_name, refresh_time, completed 
FROM timescaledb_information.job_stats 
WHERE proc_schema = '_timescaledb_catalog';

SELECT * FROM sensor_readings_1h ORDER BY bucket DESC LIMIT 5;
SELECT * FROM sensor_readings_5m ORDER BY bucket DESC LIMIT 5;
```

---

## Verification checklist

After any analytics fix:

- [ ] `curl /api/analytics/summary?range=1h` returns a valid shape (not error)
- [ ] `curl /api/analytics/summary?range=24h` returns a valid shape
- [ ] `curl /api/analytics/summary?from=...&to=...` returns data (custom window)
- [ ] `curl /api/analytics/climate?range=30d` returns climate stats (not error)
- [ ] `curl /api/analytics/climate?range=3m` returns plausible degreeHours (gap-cap fixed)
- [ ] `curl /api/analytics/climate?from=2019-01-01T00:00:00Z&to=2019-01-02T00:00:00Z` returns empty shape (not error)
- [ ] Frontend loads 1h / 24h without crashing
- [ ] Energy total ≈ counter delta for the range
- [ ] CAGGs are up to date (last bucket within 5 min of now)