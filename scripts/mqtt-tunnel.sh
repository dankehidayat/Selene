#!/usr/bin/env bash
# Forward local 1884 → VPS EMQX :1883 so the local backend can subscribe to
# ESP32 telemetry without changing Arduino (device keeps publishing to VPS).
#
# Usage (leave this terminal open):
#   ./scripts/mqtt-tunnel.sh
#
# Then start the backend with MQTT_HOST=127.0.0.1 MQTT_PORT=1884
# (see apps/backend/.env.local.example).

set -euo pipefail

SSH_HOST="${SSH_HOST:-rd}"
LOCAL_PORT="${LOCAL_PORT:-1884}"
# EMQX on the VPS host (docker-compose publishes 1883 on the server)
REMOTE_MQTT="${REMOTE_MQTT:-127.0.0.1:1883}"

if lsof -nP -iTCP:"${LOCAL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${LOCAL_PORT} is already in use — tunnel may already be running."
  lsof -nP -iTCP:"${LOCAL_PORT}" -sTCP:LISTEN || true
  exit 0
fi

echo "MQTT tunnel: 127.0.0.1:${LOCAL_PORT}  →  ${SSH_HOST}:${REMOTE_MQTT}"
echo "Leave this running. Ctrl+C to stop."
echo "Backend should use: MQTT_HOST=127.0.0.1 MQTT_PORT=${LOCAL_PORT}"
exec ssh -N -L "${LOCAL_PORT}:${REMOTE_MQTT}" "${SSH_HOST}"
