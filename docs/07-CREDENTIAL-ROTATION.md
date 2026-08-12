# Credential Rotation

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-12
**Status:** Published
**Type:** Runbook
**Target Environment:** Production

---

## Overview

This runbook covers rotating secrets for the Selene production stack. Rotate any credential that may have been exposed (pasted in logs, committed to git, shared inadvertently). Each section lists where the credential lives, the rotation procedure, and the expected blip duration (if any).

Only the **root `.env`** and **`apps/backend/.env`** hold secrets on the production server. Never commit real secrets.

---

## General approach

1. Edit the `.env` file on the production server
2. Restart affected services
3. Verify the new credential works
4. Update the local `.env` (if it mirrors production)

---

## 1. PostgreSQL (`selene_admin` / `selene`)

| Attribute | Value |
|-----------|-------|
| File | `~/Developer/Selene/.env` |
| Vars | `POSTGRES_PASSWORD` |
| Also in | `DATABASE_URL` in `apps/backend/.env` |

### Rotate

```bash
cd ~/Developer/Selene

# Generate new password (16+ chars, mixed case + digits + special)
NEW_PG_PASS=$(openssl rand -base64 18 | tr '+/=' '._-')
echo "POSTGRES_PASSWORD=$NEW_PG_PASS"

# Edit .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PG_PASS/" .env

# Update DATABASE_URL in apps/backend/.env
OLD_PG_PASS="<current password>"
sed -i "s/$OLD_PG_PASS/$NEW_PG_PASS/" apps/backend/.env

# Restart services
sudo docker compose -f docker-compose.modular.yml up -d postgres backend auth

# Verify
sudo docker exec selene-backend printenv DATABASE_URL | grep -c "$NEW_PG_PASS"
```
**Blip:** Postgres restart (~10 s). Auth + backend will reconnect automatically.

---

## 2. TimescaleDB (`selene_ts` / `selene_measurements`)

| Attribute | Value |
|-----------|-------|
| File | `~/Developer/Selene/.env` |
| Vars | `TIMESCALE_PASSWORD` |
| Also in | `TIMESCALE_URL` in `apps/backend/.env` |

Same procedure as Postgres, using `TIMESCALE_PASSWORD` and updating the password portion of `TIMESCALE_URL`.

---

## 3. EMQX dashboard admin

| Attribute | Value |
|-----------|-------|
| File | `~/Developer/Selene/.env` |
| Vars | `EMQX_DASHBOARD_PASSWORD` |

### Rotate

```bash
cd ~/Developer/Selene
NEW_EMQX_PASS=$(openssl rand -base64 12)
sed -i "s/^EMQX_DASHBOARD_PASSWORD=.*/EMQX_DASHBOARD_PASSWORD=$NEW_EMQX_PASS/" .env
sudo docker compose -f docker-compose.modular.yml up -d emqx
```

**Blip:** EMQX restart (~5 s). MQTT clients will disconnect and reconnect.

Dashboard credentials only seed on the **first boot of a fresh `emqx_data` volume**. On a running volume, the old password persists in the database. To apply the new password:

```bash
# Via API
curl -u admin:<old-password> -X PUT \
  http://127.0.0.1:18083/api/v5/dashboard/admin \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$NEW_EMQX_PASS\"}"
```

---

## 4. MQTT device user (`selene`)

| Attribute | Value |
|-----------|-------|
| File | `~/Developer/Selene/.env` |
| Vars | `MQTT_PASSWORD` |

### Rotate

```bash
cd ~/Developer/Selene
NEW_MQTT_PASS=$(openssl rand -base64 10)
sed -i "s/^MQTT_PASSWORD=.*/MQTT_PASSWORD=$NEW_MQTT_PASS/" .env
sudo docker compose -f docker-compose.modular.yml up -d emqx backend ingestor firmware

# Update the password in EMQX's built_in_database
curl -u admin:<dashboard-password> -X PUT \
  http://127.0.0.1:18083/api/v5/authentication/password_based:built_in_database/users/selene \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$NEW_MQTT_PASS\"}"
```

**Blip:** EMQX restart (~5 s). MQTT clients reconnect with new credentials. ESP32 devices also need the new password if they connect directly (update firmware `MQTT_PASSWORD` and flash).

---

## 5. JWT secrets

| Attribute | Value |
|-----------|-------|
| File | `~/Developer/Selene/.env` |
| Vars | `JWT_SECRET`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` |
| Also in | `apps/backend/.env` (same values) |

### Generate new Ed25519 key pair

```bash
# Generate private key
PRIVATE_KEY=$(openssl genpkey -algorithm ED25519 -outform DER 2>/dev/null | base64)
# Derive public key
PRIVATE_KEY_FILE=$(mktemp)
echo "$PRIVATE_KEY" | base64 -d > "$PRIVATE_KEY_FILE"
PUBLIC_KEY=$(openssl pkey -in "$PRIVATE_KEY_FILE" -pubout -outform DER | base64)
rm "$PRIVATE_KEY_FILE"

# Generate random secret
JWT_SECRET=$(openssl rand -hex 32)

# Update .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
sed -i "s|^JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=$PRIVATE_KEY|" .env
sed -i "s|^JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=$PUBLIC_KEY|" .env

# Update apps/backend/.env (same)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" apps/backend/.env
sed -i "s|^JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=$PRIVATE_KEY|" apps/backend/.env
sed -i "s|^JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=$PUBLIC_KEY|" apps/backend/.env

# Restart services
sudo docker compose -f docker-compose.modular.yml up -d backend auth
```

**Blip:** All existing sessions invalidated. Users must re-login.

---

## 6. Resend API key

| Attribute | Value |
|-----------|-------|
| File | `apps/backend/.env` |
| Vars | `RESEND_API_KEY` |

Generate a new key at [resend.com](https://resend.com/api-keys). Update the file, then:

```bash
sudo docker compose -f docker-compose.modular.yml up -d backend auth
```

**Blip:** None. In-flight email sends may fail if the key was revoked before the update.

---

## Verification

After any rotation:

```bash
# Check the var reaches the container
sudo docker exec selene-backend printenv <VARIABLE_NAME> | head -c 12

# Verify the service starts
sudo docker logs selene-backend --tail 5

# Check production frontend loads
curl -s -o /dev/null -w "%{http_code}" https://selene.dankehidayat.my.id
# Expect: 200
```

---

## Rotation schedule

| Credential | Recommended interval |
|------------|---------------------|
| JWT keys | Every 6 months |
| Postgres / TimescaleDB | Every 12 months |
| EMQX dashboard | Every 12 months |
| MQTT device password | Every 12 months (coordinated with firmware update) |
| Resend API key | After any suspected leak |
| Any exposed secret | Immediately |