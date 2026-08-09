# TimescaleDB Data Restoration Guide

## Problem
Your TimescaleDB database was reset during deployment, losing all historical energy/climate sensor data from 2025-2026.

## Solution
Import your CSV data from Google Sheets into TimescaleDB using the automated script.

---

## Step-by-Step Instructions

### 1. Export Data from Google Sheets

1. Open your spreadsheet: https://docs.google.com/spreadsheets/d/1O_k61ffjeUfEyYZYfi4nW6AF-asfPCQIiUSkFhi2uyM/edit
2. Go to **File → Download → Comma-separated values (.csv)**
3. Save as `selene-data-export.csv`

### 2. Transfer to VPS

Copy the CSV file to your VPS (VMD144124):

```bash
# From your local machine:
scp selene-data-export.csv nishimiya@vmd144124:/home/nishimiya/

# OR manually upload via FTP/SFTP if preferred
```

### 3. Apply Database Schema (One-time)

SSH into your VPS:

```bash
ssh nishimiya@vmd144124
cd ~/Developer/Selene

# Check current migration status
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "\dt"

# If sensor_readings doesn't exist, apply schema:
sudo docker exec -i selene-db-timescale psql -U timescaledb -d selene_measurements \
  -f migrations/create-sensor-readings.sql
```

### 4. Import Your Data

**Option A: Live import (recommended for production)**

```bash
cd ~/Developer/Selene

# Make sure deployment script is executable
chmod +x tools/import-data.sh

# Run import (this will actually insert data)
sudo ./tools/import-data.sh ~/selene-data-export.csv

# Expected output:
# ✓ Data imported successfully!
# ✓ Imported XXXX energy readings into TimescaleDB
```

**Option B: Test first with dry-run**

```bash
sudo ./tools/import-data.sh ~/selene-data-export.csv --dry-run
```

This shows you what SQL will be executed without actually inserting data.

### 5. Verify Import

After import completes, verify the data:

```bash
# Total count of imported records
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "SELECT COUNT(*) FROM sensor_readings WHERE node_id = 'office-main';"

# Latest record
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "SELECT * FROM sensor_readings ORDER BY time DESC LIMIT 1;"

# Date range
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "SELECT MIN(time), MAX(time) FROM sensor_readings;"

# Sample recent data (last 5 records)
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "SELECT time, ac_voltage, ac_power, temperature, humidity, temp_comfort, energy_status 
      FROM sensor_readings 
      WHERE node_id = 'office-main' 
      ORDER BY time DESC 
      LIMIT 5;"
```

Expected: You should see data from February 2026 onwards matching your CSV.

### 6. Restart Monitoring Dashboard

If your frontend/dashboard needs to reflect the new data:

```bash
sudo docker compose -f docker-compose.modular.yml restart selene-frontend
```

The data will now be available in your API endpoints at:
- `/api/readings/latest`
- `/api/readings/history?range=30d`
- `/api/analytics/summary?range=30d`

---

## Data Column Mapping

| CSV Column | DB Column | Type | Notes |
|------------|-----------|------|-------|
| Timestamp | `time` | TIMESTAMPTZ | Auto-converted to PostgreSQL format |
| AC Voltage (V0) | `ac_voltage` | NUMERIC | Volts |
| AC Current (V1) | `ac_current` | NUMERIC | Amperes |
| AC Power (V2) | `ac_power` | NUMERIC | Watts |
| Cos Phi (V3) | `cos_phi` | NUMERIC | Power factor |
| Apparent Power (V4) | `apparent_power` | NUMERIC | Volt-amperes |
| Total Energy (V5) | `total_energy` | NUMERIC | kWh |
| Frequency (V6) | `frequency` | NUMERIC | Hz (default 50) |
| Reactive Power (V7) | `reactive_power` | NUMERIC | VAR |
| Temperatur (V8) | `temperature` | NUMERIC | °C |
| Humidity (V9) | `humidity` | NUMERIC | % RH |
| Temp Comfort (V10) | `temp_comfort` | TEXT | COMFORTABLE/COLD/WARM/etc |
| Energy Status (V11) | `energy_status` | TEXT | NORMAL/ECONOMICAL/WASTEFUL (auto-converted from numbers 1/2/3) |
| Current per kW (V12) | `current_per_kw` | NUMERIC | A/kW |
| Power Quality Score (V13) | `power_quality_score` | NUMERIC | 0-100 |
| Energy Cost (V14) | `energy_cost` | NUMERIC | Currency value |
| Voltage Stability (V15) | `voltage_stability` | NUMERIC | Percentage |

---

## Future Prevention

To prevent data loss in the future:

### 1. Enable Continuous Backups
TimescaleDB supports continuous aggregation policies. Add to your cron:

```bash
crontab -e

# Daily backup at 2 AM
0 2 * * * sudo docker exec selene-db-timescale pg_dump -U timescaledb selene_measurements > /backup/timescaledb-$(date +\%Y\%m\%d).dump
```

### 2. Regular Snapshots
Schedule weekly exports:

```bash
mkdir -p /backup/selene-weekly
cronjob:
  0 3 * * 0 sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
    -c "COPY (SELECT * FROM sensor_readings WHERE time >= NOW() - INTERVAL '7 days') TO STDOUT WITH CSV HEADER" \
    > /backup/selene-weekly/readings_$(date +\%Y\%w).csv
```

### 3. Use Persistent Volumes
Your current Docker Compose uses named volumes which persist container removals. Verify they exist:

```bash
sudo docker volume ls | grep selene
# Should show: selene_db_data, selene_tsdata
```

Keep these volumes intact during deployments!

---

## Troubleshooting

### Issue: Import fails with permission denied
```bash
# Fix: Check Docker group membership
sudo usermod -aG docker $USER
# Then logout/login again

# Or use sudo explicitly for Docker commands
```

### Issue: Timestamp conversion errors
The script handles common formats, but if you have irregular dates:
- View sample problematic rows:
```bash
tail -n +2 selene-data-export.csv | head -20
```

### Issue: Column mismatch
If your CSV has different column order or missing columns, edit the import script:
```bash
nano tools/import-data.sh
# Update the IFS=',' read statement to match your CSV structure
```

### Issue: Duplicate entries
If importing twice creates duplicates:
```bash
# Check for duplicates
sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
  -c "SELECT time, COUNT(*) FROM sensor_readings GROUP BY time HAVING COUNT(*) > 1;"

# Clean up duplicates (keeps one copy)
sudo docker exec -i selene-db-timescale psql -U timescaledb -d selene_measurements << 'EOF'
DELETE FROM sensor_readings WHERE ctid NOT IN (
  SELECT min(ctid) FROM sensor_readings GROUP BY time, node_id
);
EOF
```

---

## Questions?

Common scenarios handled automatically:
- ✅ Mixed text/number status codes (NORMAL vs "2")
- ✅ Missing/empty values → defaults applied
- ✅ Date format conversions
- ✅ Energy cost currency formatting (Rp → number)

Need help? Check the logs at:
```bash
/var/log/selene/
```

---

*Last updated: 2026-08-09*
