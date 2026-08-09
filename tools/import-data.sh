#!/bin/bash
# =============================================================================
# TimescaleDB Data Import Script
#
# Usage:
#   $0 <csv-file> [--dry-run]                          # import from local CSV
#   $0 --sheet <url-or-id> [--dry-run]                 # fetch live Google Sheet
#
# Google Sheets mode downloads the gid=0 tab as CSV via the public export
# endpoint and keeps only the main device block (columns 1-17). The HTC-1
# climate block (columns 19-21) is intentionally skipped.
# =============================================================================

set -euo pipefail

TIMESCALE_HOST="localhost"
TIMESCALE_PORT="5433"
TIMESCALE_DB="selene_measurements"
TIMESCALE_USER="selene_ts"

# Parse arguments
DRY_RUN=false
INPUT_FILE=""
SHEET_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --sheet) SHEET_ARG="$2"; shift 2 ;;
    *) INPUT_FILE="$1"; shift ;;
  esac
done

if [ -n "$SHEET_ARG" ]; then
  # --- Google Sheets mode --------------------------------------------------
  SHEET_ID="$SHEET_ARG"
  if [[ "$SHEET_ARG" =~ /d/([^/]+) ]]; then
    SHEET_ID="${BASH_REMATCH[1]}"
  fi
  SHEET_URL="https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0"
  echo "Fetching sheet CSV export:"
  echo "  $SHEET_URL"

  SHEET_CSV="/tmp/selene-sheet-$(date +%s).csv"
  if ! curl -sSL --max-time 60 "$SHEET_URL" -o "$SHEET_CSV"; then
    echo "✗ Failed to download Google Sheet (is it public / link-shared?)"
    exit 1
  fi

  TOTAL_LINES=$(wc -l < "$SHEET_CSV")
  echo "Downloaded $TOTAL_LINES lines."

  # Normalize: keep only columns 1-17 (drop blank col 18 + HTC-1 block).
  # Also convert dates here to stay portable (Linux/macOS).
  NORMALIZED_CSV="/tmp/gselene-sheet-normalized-$(date +%s).csv"
  awk -F',' '
    NR == 1 {
      # header row passed through untouched
      print
      next
    }
    NF < 17 { next }
    {
      # convert M/D/YYYY h:mm:ss -> YYYY-MM-DD hh:mm:ss
      n = split($1, d, /[\/ :]+/)
      # d[1]=month d[2]=day d[3]=year d[4]=h d[5]=m d[6]=s
      hh = (n >= 4) ? d[4] : 0
      mm = (n >= 5) ? d[5] : 0
      ss = (n >= 6) ? d[6] : 0
      ts = sprintf("%04d-%02d-%02d %02d:%02d:%02d", d[3], d[1], d[2], hh, mm, ss)
      row = ts
      for (i = 2; i <= 17; i++) row = row "," $i
      print row
    }' "$SHEET_CSV" > "$NORMALIZED_CSV"

  rm -f "$SHEET_CSV"
  INPUT_FILE="$NORMALIZED_CSV"
  echo "Normalized to main block (cleaned $NORMALIZED_CSV)."
fi

if [ -z "$INPUT_FILE" ]; then
  echo "Usage: $0 <csv-file> [--dry-run]"
  echo "   or: $0 --sheet <google-sheets-url-or-id> [--dry-run]"
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
  
  # Skip rows that failed date normalization (left as unparsable)
  if [[ "$ts" != [0-9][0-9][0-9][0-9]-* ]]; then
    echo "WARN: skipping row $LINE_NUM with unconverted timestamp: $ts"
    continue
  fi
  
  cat >> "$SQL_FILE" << INSERT
INSERT INTO sensor_readings (
  time, ac_voltage, ac_current, ac_power, cos_phi, 
  apparent_power, total_energy, frequency, reactive_power,
  temperature, humidity, temp_comfort, energy_status,
  current_per_kw, power_quality_score, energy_cost, voltage_stability
) VALUES (
  '$ts',
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
  '$ENERGY_COST',
  COALESCE(NULLIF('$VOLTAGE_STABILITY',''), 100)::numeric
);
INSERT

  if [ $((LINE_NUM % 100)) -eq 0 ]; then
    echo "Processed $LINE_NUM records..."
  fi
done

cat >> "$SQL_FILE" << 'FOOTER'

COMMIT;

SELECT count(*) FROM sensor_readings;
FOOTER

echo "SQL file generated: $SQL_FILE ($(wc -l < "$SQL_FILE") statements)"

if $DRY_RUN; then
  echo "--- DRY RUN MODE ---"
  grep -A 19 "^INSERT INTO sensor_readings" "$SQL_FILE" | head -60
else
  echo "--- EXECUTING IMPORT ---"
  
  export PGPASSWORD=$(sudo docker exec selene-db-timescale printenv POSTGRES_PASSWORD 2>/dev/null | tr -d '\n')
  
  sudo docker exec -i selene-db-timescale psql \
    -U selene_ts \
    -d selene_measurements \
    < "$SQL_FILE"
  
  RESULT=$?
  
  if [ $RESULT -eq 0 ]; then
    echo "Data imported successfully!"
    
    COUNT=$(sudo docker exec selene-db-timescale psql -U selene_ts -d selene_measurements \
      -t -c "SELECT count(*) FROM sensor_readings;" 2>/dev/null | tr -d ' ')
    
    echo "Imported $COUNT energy readings into TimescaleDB"
  else
    echo "Import failed with code $RESULT"
  fi
fi

rm -f "$SQL_FILE"
echo "Done!"