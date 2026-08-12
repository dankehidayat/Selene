# Data Recovery

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-12
**Status:** Published
**Type:** Runbook
**Target Environment:** Production

---

## Overview

TimescaleDB stores all sensor readings in the `sensor_readings` hypertable. This runbook covers backup, restoration, deduplication, and continuous aggregate refresh.

The primary data source is the ESP32 MQTT stream (live, first-party data). The secondary source is the Google Sheet (`docs/04-DATA-RECOVERY.md` in the original DATA_RESTORATION_GUIDE.md means this file — the sheet URL is `https://docs.google.com/spreadsheets/d/1O_k61ffjeUfEyYZYfi4nW6AF-asfPCQIiUSkFhi2uyM/`), which contains historical backfill.

---

## Prerequisites & Access

- `sudo` privileges on the production server (Docker)
- `sudo docker exec` access to `selene-timescaledb`

---

## Architecture & Context

- TimescaleDB container: `selene-timescaledb`
- Database: `selene_measurements`
- User: `selene_ts` (password from `TIMESCALE_PASSWORD` in `.env`)
- Hypertable: `sensor_readings` (7-day chunks)
- Continuous aggregates: `sensor_readings_5m`, `sensor_readings_1h`
- Volume: `timescale_data` (persistent, survives container removal)
- The `tools/import-data.sh` script is **deprecated** — see notes

---

## Escalation Paths

**Sole maintainer:** Danke Hidayat. If the `timescale_data` volume is lost, data must be re-imported from the Google Sheet and/or MQTT history.

---

## 1. Backup

### Full dump

```bash
sudo docker exec selene-timescaledb pg_dump -U selene_ts -d selene_measurements \
  --format=custom \
  -f /tmp/selene_measurements_$(date +%Y%m%d).dump

# Copy to host
sudo docker cp selene-timescaledb:/tmp/selene_measurements_$(date +%Y%m%d).dump \
  ~/backups/selene_measurements_$(date +%Y%m%d).dump
```

### Sensor readings only (CSV, faster)

```bash
sudo docker exec selene-timescaledb psql -U selene_ts -d selene_measurements \
  -c "\COPY sensor_readings TO '/tmp/sensor_readings_$(date +%Y%m%d).csv' WITH CSV HEADER"

sudo docker cp selene-timescaledb:/tmp/sensor_readings_$(date +%Y%m%d).csv \
  ~/backups/sensor_readings_$(date +%Y%m%d).csv
```

### Automated backup (cron)

```bash
# Add to crontab (runs daily at 2 AM)
crontab -e
0 2 * * * sudo docker exec selene-timescaledb pg_dump -U selene_ts -d selene_measurements --format=custom -f /tmp/tsdb_$(date +\%Y\%m\%d).dump && sudo docker cp selene-timescaledb:/tmp/tsdb_$(date +\%Y\%m\%d).dump ~/backups/ && sudo docker exec selene-timescaledb rm /tmp/tsdb_$(date +\%Y\%m\%d).dump
```

Weekly CSV exports are also recommended.

---

## 2. Restore

### From full dump

```bash
# First, ensure the volume exists and is empty (or start fresh)
sudo docker compose -f docker-compose.modular.yml down
sudo docker volume rm selene_timescale_data
sudo docker compose -f docker-compose.modular.yml up -d timescaledb

# Wait for TimescaleDB to be healthy, then restore
sudo docker exec -i selene-timescaledb pg_restore -U selene_ts -d selene_measurements \
  --format=custom --clean --if-exists < selene_measurements_20260812.dump
```

### From CSV backup

```bash
sudo docker exec -i selene-timescaledb psql -U selene_ts -d selene_measurements \
  -c "\COPY sensor_readings FROM 'selene_backup.csv' WITH CSV HEADER"
```

After restore, refresh continuous aggregates:

```sql
CALL refresh_continuous_aggregate('sensor_readings_5m', NULL, NULL);
CALL refresh_continuous_aggregate('sensor_readings_1h', NULL, NULL);
```

---

## 3. Google Sheet import (one-time use)

**The `tools/import-data.sh` script is deprecated.** It was used on 2026-08-09 to import ~12,295 historical rows from Google Sheets. The script has known issues:

- Container name hard-coded to `selene-db-timescale` (modular name — does not match production `selene-timescaledb`)
- No timezone conversion (inserts WIB+7 timestamps as if UTC — the first run happened to work because manual psql corrected this)
- No deduplication (`ON CONFLICT` not available without unique constraint)

If re-import is ever needed, use the sheet directly:

### Download from Google Sheets

```bash
SHEET_ID="1O_k61ffjeUfEyYZYfi4nW6AF-asfPCQIiUSkFhi2uyM"
curl -L "https://docs.google.com/spreadsheets/d/$SHEET_ID/export?format=csv&gid=0" \
  -o selene-sheet.csv
```

### Import with psql

```bash
sudo docker exec -i selene-timescaledb psql -U selene_ts -d selene_measurements << 'EOF'
BEGIN;
-- One-time truncate if replacing all data
-- TRUNCATE sensor_readings;

-- Import rows with proper timezone handling
-- (sheet timestamps are WIB/GMT+7, stored as UTC)
COPY sensor_readings (time, ac_voltage, ac_current, ac_power, cos_phi, apparent_power, total_energy, frequency, reactive_power, temperature, humidity, temp_comfort, energy_status, current_per_kw, power_quality_score, energy_cost, voltage_stability)
FROM '/tmp/selene-sheet.csv' WITH CSV HEADER;
COMMIT;
```

---

## 4. Deduplication

Since `sensor_readings` has no unique constraint, duplicate rows can accumulate when the same data arrives from both MQTT and sheet import.

### Check for duplicates

```sql
SELECT time, COUNT(*)
FROM sensor_readings
GROUP BY time
HAVING COUNT(*) > 1
ORDER BY time;
```

### Remove duplicates (earliest-wins strategy)

```sql
DELETE FROM sensor_readings WHERE ctid NOT IN (
  SELECT MIN(ctid) FROM sensor_readings GROUP BY time
);
```

This keeps the first physical row for each timestamp (MQTT rows are newest-first by insertion order typically; if sheet rows were inserted first, earliest-wins preserves them over MQTT duplicates). The MQTT ingestor uses `ON CONFLICT DO NOTHING`, which only triggers if a unique constraint existed; with no constraint, duplicates slip through.

**Time-window tolerance:** If MQTT and sheet timestamps differ by seconds (same event, slightly different arrival time), a 60-second tolerance merge is safer:

```sql
-- Before deduplicating, align close timestamps
UPDATE sensor_readings t1
SET time = t2.time
FROM sensor_readings t2
WHERE ABS(EXTRACT(EPOCH FROM (t1.time - t2.time))) < 60
  AND t1.ctid != t2.ctid
  AND t1.time > t2.time;
```

Then run the `DELETE` above. Verify the counts before/after.

### Verify dedup

```sql
SELECT COUNT(*) FROM sensor_readings;
-- Compare with known counts
```

---

## 5. Continuous aggregate refresh

After any data modification (import, dedup, truncate), refresh the CAGGs:

```sql
CALL refresh_continuous_aggregate('sensor_readings_5m', NULL, NULL);
CALL refresh_continuous_aggregate('sensor_readings_1h', NULL, NULL);
```

### Check CAGG status

```sql
SELECT view_name, refresh_time, completed
FROM timescaledb_information.job_stats
WHERE proc_schema = '_timescaledb_catalog';

SELECT * FROM sensor_readings_1h ORDER BY bucket DESC LIMIT 5;
SELECT * FROM sensor_readings_5m ORDER BY bucket DESC LIMIT 5;
```

---

## 6. Dangerous operations to avoid

| Operation | Why it is dangerous | Safer alternative |
|-----------|-------------------|-------------------|
| `docker volume prune -f` | Deletes all orphaned volumes, including `timescale_data` and `postgres_data` | Use `docker volume rm <specific-volume-name>` after confirming |
| `docker compose down -v` | Destroys volumes along with containers | Use `docker compose down` (no `-v`) |
| Truncating `sensor_readings` without backup | Permanent data loss | Dump first, then truncate |
| Running `import-data.sh` without `--truncate` | Duplicates existing rows | Use `--truncate` or dedupe after |

---

## 7. Data source timeline

| Period | Source | Rows | Notes |
|--------|--------|------|-------|
| Oct 2025 – Apr 2026 | Google Sheet (backfill) | ~10,700 | Sensor installed Oct 2025 |
| Apr 30 – Jul 9, 2026 | — | No data | Device offline |
| Jul 9 – Aug 7, 2026 | MQTT + Sheet overlap | ~1,600 each | Both sources active |
| Aug 7 – Aug 12, 2026 | Google Sheet only | ~500 | MQTT offline (EMQX crash-loop) |
| Aug 12+ | MQTT (after fix) | Live | EMQX fixed, device reconnects |

Total unique rows in DB: ~12,295 (sheet) + MQTT rows (overlapping timestamps deduped).