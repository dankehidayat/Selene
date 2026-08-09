#!/bin/bash
# =============================================================================
# TimescaleDB Data Import Script
# =============================================================================

set -euo pipefail

TIMESCALE_HOST="localhost"
TIMESCALE_PORT="5433"
TIMESCALE_DB="selene_measurements"
TIMESCALE_USER="selene_ts"

# Parse arguments
DRY_RUN=false
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    *) INPUT_FILE="$1"; shift ;;
  esac
done

if [ -z "$INPUT_FILE" ]; then
  echo "Usage: $0 <csv-file> [--dry-run]"
  echo ""
  echo "CSV must have these columns:"
  echo "  Timestamp,AC Voltage,V0,AC Current,V1,AC Power,V2,Cos Phi,V3,"
  echo "  Apparent Power,V4,Total Energy,V5,Frequency,V6,Reactive Power,V7,"
  echo "  Temperature,V8,Humidity,V9,Temp Comfort,V10,Energy Status,V11,"
  echo "  Current per kW,V12,Power Quality Score,V13,Energy Cost,V14,"
  echo "  Voltage Stability,V15"
  exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "File not found: $INPUT_FILE"
  exit 1
fi

RECORD_COUNT=$(tail -n +2 "$INPUT_FILE" | wc -l)
echo "Found $RECORD_COUNT data records in $INPUT_FILE"

SQL_FILE="/tmp/timescale-import-$(date +%s).sql"

cat > "$SQL_FILE" << 'HEADER'
BEGIN;

HEADER

LINE_NUM=0
ERRORS=0

tail -n +2 "$INPUT_FILE" | while IFS=',' read -r ts v0 v1 v2 v3 v4 v5 v6 v7 v8 v9 v10 v11 v12 v13 v14 v15; do
  
  [ -z "$ts" ] && continue
  
  LINE_NUM=$((LINE_NUM + 1))
  
  # Convert date format: 2/26/2026 6:41:06 -> 2026-02-26 06:41:06
  converted_ts=$(date -d "$ts" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "2026-01-01 00:00:00")
  
  # Handle numeric values safely
  AC_VOLTAGE=${v0:-0}
  AC_CURRENT=${v1:-0}
  AC_POWER=${v2:-0}
  COS_PHI=${v3:-0}
  APPARENT_POWER=${v4:-0}
  TOTAL_ENERGY=${v5:-0}
  FREQUENCY=${v6:-50}
  REACTIVE_POWER=${v7:-0}
  TEMPERATURE=${v8:-25}
  HUMIDITY=${v9:-60}
  TEMP_COMFORT="${v10:-COMFORTABLE}"
  ENERGY_STATUS_RAW="${v11:-NORMAL}"
  
  # Convert number status to enum (V11 could be 1/2/3 or text)
  case "$ENERGY_STATUS_RAW" in
    1|ECONOMICAL|economical) ENERGY_STATUS='ECONOMICAL' ;;
    2|NORMAL|normal) ENERGY_STATUS='NORMAL' ;;
    3|WASTEFUL|wasteful) ENERGY_STATUS='WASTEFUL' ;;
    *) ENERGY_STATUS='NORMAL' ;;
  esac
  
  CURRENT_PER_KW=${v12:-0}
  POWER_QUALITY_SCORE=${v13:-40}
  ENERGY_COST=$(echo "$v14" | sed 's/Rp //g;s/[[:space:]]//g')
  ENERGY_COST=${ENERGY_COST:-0}
  VOLTAGE_STABILITY=${v15:-100}
  
  cat >> "$SQL_FILE" << INSERT
INSERT INTO sensor_readings (
  time, node_id, ac_voltage, ac_current, ac_power, cos_phi, 
  apparent_power, total_energy, frequency, reactive_power,
  temperature, humidity, temp_comfort, energy_status,
  current_per_kw, power_quality_score, energy_cost, voltage_stability
) VALUES (
  '$converted_ts', 'office-main',
  COALESCE(NULLIF('$AC_VOLTAGE',''), 0)::numeric,
  COALESCE(NULLIF('$AC_CURRENT',''), 0)::numeric,
  COALESCE(NULLIF('$AC_POWER',''), 0)::numeric,
  COALESCE(NULLIF('$COS_PHI',''), 0)::numeric,
  COALESCE(NULLIF('$APPARENT_POWER',''), 0)::numeric,
  COALESCE(NULLIF('$TOTAL_ENERGY',''), 0)::numeric,
  COALESCE(NULLIF('$FREQUENCY',''), 50)::numeric,
  COALESCE(NULLIF('$REACTIVE_POWER',''), 0)::numeric,
  COALESCE(NULLIF('$TEMPERATURE',''), 25)::numeric,
  COALESCE(NULLIF('$HUMIDITY',''), 60)::numeric,
  '$TEMP_COMFORT',
  '$ENERGY_STATUS',
  COALESCE(NULLIF('$CURRENT_PER_KW',''), 0)::numeric,
  COALESCE(NULLIF('$POWER_QUALITY_SCORE',''), 40)::numeric,
  COALESCE(NULLIF('$ENERGY_COST',''), 0)::numeric,
  COALESCE(NULLIF('$VOLTAGE_STABILITY',''), 100)::numeric
);
INSERT

  if [ $((LINE_NUM % 100)) -eq 0 ]; then
    echo "Processed $LINE_NUM records..."
  fi
done

cat >> "$SQL_FILE" << 'FOOTER'

COMMIT;

SELECT count(*) FROM sensor_readings WHERE node_id = 'office-main';
FOOTER

echo "SQL file generated: $SQL_FILE ($(wc -l < "$SQL_FILE") statements)"

if $DRY_RUN; then
  echo "--- DRY RUN MODE ---"
  grep -A 19 "^INSERT INTO sensor_readings" "$SQL_FILE" | head -60
else
  echo "--- EXECUTING IMPORT ---"
  
  export PGPASSWORD=$(sudo docker exec selene-db-timescale printenv POSTGRES_PASSWORD 2>/dev/null | tr -d '\n')
  
  sudo docker exec -i selene-db-timescale psql \
    -U timescaledb \
    -d selene_measurements \
    -f "$SQL_FILE"
  
  RESULT=$?
  
  if [ $RESULT -eq 0 ]; then
    echo "✓ Data imported successfully!"
    
    COUNT=$(sudo docker exec selene-db-timescale psql -U timescaledb -d selene_measurements \
      -t -c "SELECT count(*) FROM sensor_readings WHERE node_id = 'office-main';" 2>/dev/null | tr -d ' ')
    
    echo "✓ Imported $COUNT energy readings into TimescaleDB"
  else
    echo "✗ Import failed with code $RESULT"
  fi
fi

rm -f "$SQL_FILE"
echo "Done!"
