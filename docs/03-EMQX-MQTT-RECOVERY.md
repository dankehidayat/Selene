# EMQX / MQTT Recovery

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-14
**Status:** Published
**Type:** Runbook
**Target Environment:** Production

---

## Overview

EMQX is the MQTT broker that connects ESP32 field devices to the Selene backend and ingestor. This runbook covers recovery from the two most common failure modes: **crash-loop** (the broker restarts every ~43 s) and **`not_authorized`** (MQTT clients cannot connect despite correct credentials). Both were encountered on 2026-08-12.

> **Current status:** The EMQX bootstrap mechanism that caused the crash-loop (`EMQX_API_KEY__BOOTSTRAP_FILE`) has been **fully removed** from `docker-compose.modular.yml`, all env examples, and `deploy/emqx-api-key.conf`. A fresh deployment from current master will not crash. The crash-loop recovery steps below are retained for older `.env` files that still carry the stale variables.

---

## Prerequisites & Access

- `sudo` privileges on the production server (Docker)
- Root `.env` file at `~/Developer/Selene/.env`

---

## Symptom: EMQX crash-loop

### What you see

```
2026-08-12T12:23:15.123 [error] failed_to_open_the_bootstrap_file, file: /opt/emqx/etc/default_api_key.conf, reason: no such file or directory
2026-08-12T12:23:15.124 [error] emqx_management: failed to start http listener
2026-08-12T12:23:15.125 [critical] Kernel pid terminated
```

Container restarts every ~43 s. Backend logs show `[MQTT] Connection error: connect ECONNREFUSED 172.20.0.5:1883`.

### Root cause

**This issue is now fixed in master.** The root `.env` file contained `EMQX_API_KEY__BOOTSTRAP_FILE=/opt/emqx/etc/default_api_key.conf`, which tells EMQX 5.x to read an API-key bootstrap file on startup. When the compose file did **not** mount that file into the container, EMQX's management app crashed.

The fix removed the bootstrap variables from the canonical compose (`docker-compose.modular.yml`) and all env examples. The `deploy/emqx-api-key.conf` file and `emqx-init` provisioning service were also removed. The crash can no longer occur on a deployment built from current master.

If you are recovering a crash that already happened, the resolution below clears the stale `.env` variables.

### Resolution

**Remove the bootstrap variables from `.env`:**

```bash
cd ~/Developer/Selene
sed -i '/EMQX_API_KEY__BOOTSTRAP_FILE/d; /EMQX_BOOTSTRAP_SECRET/d' .env
```

Then restart EMQX:

```bash
sudo docker compose -f docker-compose.modular.yml restart emqx
```

### Verify

```bash
# EMQX should stay up > 60 s
sudo docker ps --filter name=selene-emqx --filter status=running

# Backend should reconnect
sudo docker logs selene-backend --tail 20 | grep -i mqtt
# Expect: "[MQTT] Connected"
```

---

## Symptom: `not_authorized` on MQTT connect

### What you see

```
[MQTT] Connection error: Not authorized
```

### Root cause

With `EMQX_ALLOW_ANONYMOUS=false` and `EMQX_AUTH_MECHANISM=password_based`, EMQX requires the MQTT user (`selene`) to exist in its `built_in_database`. The user persists in the `emqx_data` Docker volume. If that volume was wiped — or if this is a first deployment — the user must be created.

### Resolution

**Via EMQX Dashboard API** (EMQX must be running):

```bash
# Create the MQTT user (adjust password as needed)
curl -u admin:${EMQX_DASHBOARD_PASSWORD} -X POST \
  http://127.0.0.1:18083/api/v5/authentication/password_based:built_in_database/users \
  -H "Content-Type: application/json" \
  -d '{"user_id":"selene","password":"selene123"}'
```

Or use the EMQX Dashboard at `https://emqx.dankehidayat.my.id`: **Dashboard → Authentication → Password-Based → Add**.

### Verify

```bash
curl -s -u admin:${EMQX_DASHBOARD_PASSWORD} \
  http://127.0.0.1:18083/api/v5/authentication/password_based:built_in_database/users \
  | grep -c selene
# Expect: 1
```

---

## Symptom: ECONNREFUSED (backend cannot reach EMQX)

### Root cause

Usually a downstream effect of the crash-loop above. Also check:

1. EMQX is running: `sudo docker ps --filter name=selene-emqx`
2. Port 1883 is bound: `sudo docker port selene-emqx 1883` → `0.0.0.0:1883`
3. The backend's `MQTT_HOST` is `emqx` (Docker service name, resolves via internal DNS)

If `ECONNREFUSED` persists after EMQX is healthy, restart the backend:

```bash
sudo docker compose -f docker-compose.modular.yml restart backend
```

---

## MQTT password trailing whitespace check

A space at the end of `MQTT_PASSWORD` in `.env` causes silent auth failure. Verify:

```bash
grep -n ' $' ~/Developer/Selene/.env
```

If a trailing space is found on the MQTT_PASSWORD line, edit the line and re-deploy.

---

## EMQX dashboard access

- URL: `https://emqx.dankehidayat.my.id`
- Default credentials: `admin` / value of `EMQX_DASHBOARD_PASSWORD` in `.env`
- Dashboard credentials only seed on **first boot of a fresh `emqx_data` volume**. If the volume already exists, they were set previously.

---

## Verification checklist

After any EMQX recovery:

- [ ] `sudo docker ps` shows `selene-emqx` running
- [ ] `sudo docker logs selene-backend --tail 20 | grep -i mqtt` shows `[MQTT] Connected`
- [ ] Frontend analytics pages load with live data
- [ ] Export CSV shows fresh rows (timestamp within last hour)