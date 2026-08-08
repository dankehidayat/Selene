# Selene Production Deployment Guide

## Quick Start Checklist

Before deploying, verify:

- [ ] Database migrations ready (`apps/backend/prisma/schema.prisma`)
- [ ] Environment variables configured (`.env` files)
- [ ] Docker Compose stacks configured (`docker-compose.modular.yml`)
- [ ] SSL certificates valid (Let's Encrypt)
- [ ] Resend API credentials set up
- [ ] TOTP backup codes generated

---

## Phase 1: Infrastructure Setup

### Step 1.1: Pull Latest Code

```bash
ssh rd
cd ~/Developer/Selene
git checkout master
git pull origin master
```

### Step 1.2: Verify Environment Configuration

Check `.env` file has all required variables:

```bash
cat .env | grep -E "POSTGRES_|TIMESCALE_|JWT_|RESEND_"
```

**Required Production Values:**

| Variable | Example Value | Required |
|----------|---------------|----------|
| `POSTGRES_PASSWORD` | `x9Fm2KpR7vLq4WnB8cYt3Hj6DsA1Gf5d` | ✅ Yes |
| `TIMESCALE_PASSWORD` | `k0iAjJmuzPH3xD8dh25W5Fod7B9PC73rl2qFUdnqrks=` | ✅ Yes |
| `JWT_SECRET` | HMAC key from VPS config | ✅ Yes |
| `RESEND_API_KEY` | `re_...` email delivery | ✅ Yes |
| `APP_PUBLIC_URL` | `https://selene.dankehidayat.my.id` | ✅ Yes |

### Step 1.3: Update Backend Environment

Ensure backend `.env` points to correct database URLs:

```bash
cat apps/backend/.env | grep DATABASE_URL
# Should show: postgresql://selene_admin:x9Fm2KpR7vLq4WnB8cYt3Hj6DsA1Gf5d@postgres:5432/selene
```

---

## Phase 2: Database Initialization

### Step 2.1: Run Prisma Migrations

Execute schema updates including new security tables:

```bash
docker compose -f docker-compose.modular.yml exec monolith \
  bunx prisma migrate deploy
```

**Verify Migration Success:**

```bash
docker compose -f docker-compose.modular.yml exec postgres \
  psql -U selene_admin -d selene -c "\dt" | grep -E "RoleChangeAudit|RateLimitState|ConfirmationCode"
```

Expected output:
```
public | RoleChangeAudit    | table | selene_admin
public | RateLimitState     | table | selene_admin  
public | ConfirmationCode   | table | selene_admin
```

### Step 2.2: Create Initial Admin Account

Use secure SQL approach (bypasses potential race conditions):

```bash
docker exec selene-db-postgres psql -h localhost -U selene_admin -d selene \
  -c 'INSERT INTO "User" (id, email, password, name, role, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), '"'"'dnk.hidayat@gmail.com'"'"', '"'"'$2a$12$xjsklEgYPQ6hxXoI/VVR/ecNgEbZvgARXsucvkVHZ7oaimym5goPy'"'"', '"'"'Danke Hidayat'"'"', '"'"'ADMIN'"'"', true, NOW(), NOW()) ON CONFLICT DO NOTHING;'
```

### Step 2.3: Enable 2FA for Admin Account

Instruct user to configure authenticator app after first login:

```javascript
// Frontend triggers this on profile page
const secret = generateTOTPSecret();
const uri = totpUri(user.email, secret);
console.log(`Set up authenticator with code: ${uri}`);
```

---

## Phase 3: Caddy Reverse Proxy Fix

### Current Issue

EMQX dashboard returning 404 errors due to blanket rewrite rule breaking routes.

### Solution A: Minimal Rewrite (Recommended)

Update `/etc/caddy/Caddyfile`:

```caddyfile
emqx.dankehidayat.my.id {
    # Only rewrite specific login path
    @login_path {
        path /dashboard/login
    }
    
    rewrite @login_path /dashboard/login
    
    # Pass all other paths through unchanged
    reverse_proxy localhost:18083
    
    header Upstream "http://localhost:18083"
}
```

### Solution B: Direct Proxy (Cleanest)

Simpler version without any rewrites:

```caddyfile
emqx.dankehidayat.my.id {
    reverse_proxy localhost:18083
    header Host "localhost:18083"
    header X-Upstream "http://localhost:18083"
}
```

### Apply Changes

```bash
sudo cp /tmp/emqx-caddyfix.conf /etc/caddy/Caddyfile
sudo systemctl restart caddy

# Verify fix
curl -sk https://emqx.dankehidayat.my.id/dashboard/login -I | head -5
```

Expected HTTP status: `200 OK` (not 404)

---

## Phase 4: EMQX MQTT Authentication Fix

### Step 4.1: Create MQTT Client User

Add MQTT credentials matching application configuration:

```bash
docker exec selene-mqtt-emqx emqxctl users add username=selene password=selene123
```

**Alternative via API:**

```bash
curl -X POST http://admin:admin123@localhost:18083/api/v5/users/selene \
  -H "Content-Type: application/json" \
  -d '{"password":"selene123","tag":[]}'
```

**Verify User Created:**

```bash
docker exec selene-mqtt-emqx emqxctl users list
```

### Step 4.2: Configure ACL Rules (Optional)

Grant appropriate topic permissions:

```bash
# Allow publish to telemetry topics
docker exec selene-mqtt-emqx emqxctl acl grant allow user selene topic pub "selene/+/telemetry"

# Allow subscribe to command topics  
docker exec selene-mqtt-emqx emqxctl acl grant allow user selene topic sub "selene/+/command"

# Deny access to all other topics
docker exec selene-mqtt-emqx emqxctl acl deny anonymous
```

### Step 4.3: Set Consistent Node Cookie

Fix Erlang cookie warning by setting proper cookie:

```bash
export EMQX_NODE__COOKIE="your_secure_cookie_from_vps_config"
docker compose -f docker-compose.modular.yml restart mqtt
```

**Or via container env:**

```bash
docker update --env-add EMQX_NODE__COOKIE=secure_cookie_value selene-mqtt-emqx
docker rm -f selene-mqtt-emqx
docker compose up -d mqtt
```

---

## Phase 5: Service Restart & Verification

### Step 5.1: Restart All Services

```bash
cd ~/Developer/Selene

echo "=== Restarting Services ==="
docker compose -f docker-compose.modular.yml restart \
  auth monolith frontend energy climate firmware ingestor

sleep 30
```

### Step 5.2: Verify Health Checks

```bash
echo "=== Container Status ==="
docker ps --filter "name=selene-" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== Auth Service ==="
docker logs selene-auth --tail 20 | grep -E "listening|started" || echo "Waiting..."

echo ""
echo "=== Monolith Backend ==="
docker logs selene-monolith --tail 20 | grep -E "listening|started" || echo "Waiting..."
```

### Step 5.3: Test Endpoints

**Auth Endpoint:**

```bash
TOKEN=$(curl -sk https://selene.dankehidayat.my.id/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"dnk.hidayat@gmail.com","password":"liebling131001"}' | jq -r '.token')

echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '{userId, email, role}'
```

Expected output:
```json
{
  "userId": "xxx",
  "email": "dnk.hidayat@gmail.com",
  "role": "ADMIN"
}
```

**EMQX Dashboard:**

```bash
curl -sk https://emqx.dankehidayat.my.id/dashboard/login -I | head -5
# Should return: HTTP/2 200 OK
```

---

## Phase 6: Security Hardening

### Step 6.1: Generate New JWT Secret

Create strong random key if needed:

```bash
openssl rand -hex 64 > /tmp/new-jwt-secret.txt
cat /tmp/new-jwt-secret.txt >> .env
```

Restart services:
```bash
docker compose restart monolith
```

### Step 6.2: Configure Email Notifications

Test Resend API integration:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Selene <onboarding@resend.dev>",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<h1>Hello</h1>"
  }' | jq .
```

### Step 6.3: Enable Monitoring

Add Prometheus/Grafana monitoring if not present:

```yaml
# Add to docker-compose.modular.yml:
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=change_me
```

---

## Troubleshooting Common Issues

### Issue: Login Returns 401 Error

**Possible Causes:**
1. Password hash mismatch in database
2. JWT secret rotated but tokens expired
3. Session invalidated due to role change

**Resolution:**
```bash
# Check password in DB (should start with $2a$)
docker exec selene-db-postgres psql -U selene_admin -d selene \
  -c "SELECT password FROM \"User\" WHERE email='dnk.hidayat@gmail.com';"

# If wrong hash format, regenerate:
docker exec selene-monolith bun -e "import bcrypt from 'bcryptjs'; bcrypt.hash('new_password', 12).then(console.log);"
```

### Issue: EMQX Still Returns 404 After Caddy Fix

**Debug Steps:**
1. Check Caddy reloads properly:
   ```bash
   sudo systemctl status caddy
   sudo caddy validate
   ```
2. Test EMQX directly:
   ```bash
   curl -sk http://localhost:18083/dashboard/login -I
   ```
3. Verify EMQX container health:
   ```bash
   docker inspect selene-mqtt-emqx --format '{{.State.Health.Status}}'
   ```

### Issue: MQTT Clients Authenticate Failed

**Diagnosis Flow:**
1. Check EMQX logs for authentication failures:
   ```bash
   docker logs selene-mqtt-emqx --since 5m | grep AUTHN
   ```
2. Verify user exists in EMQX:
   ```bash
   docker exec selene-mqtt-emqx emqxctl users get selene
   ```
3. Check ACL rules are configured:
   ```bash
   docker exec selene-mqtt-emqx emqxctl acl list
   ```

---

## Rollback Procedures

If deployment fails and rollback needed:

### Option A: Rollback Specific Service

```bash
docker compose -f docker-compose.modular.yml down auth
docker compose -f docker-compose.modular.yml up -d --build auth
```

### Option B: Full Environment Restore

```bash
# Stop everything
docker compose -f docker-compose.modular.yml down

# Restore from backups (if available)
docker volume restore selene_db_data selene_timescale_data

# Restart
docker compose -f docker-compose.modular.yml up -d
```

### Option C: Emergency Maintenance Mode

Put site in maintenance mode:

```bash
# Add temporary route to Caddyfile:
maint.dankehidayat.my.id {
    respond "Site under maintenance. Please try again later." 503
}
```

---

## Post-Deployment Verification

Run these tests after deployment completes:

### Functional Tests

1. **Login Page Loads**
   ```bash
   curl -sk https://selene.dankehidayat.my.id | grep -i "selene"
   ```

2. **Admin Can Login**
   ```bash
   TOKEN=$(curl ... # as above)
   curl -H "Authorization: Bearer $TOKEN" \
     https://selene.dankehidayat.my.id/api/admin/stats
   ```

3. **Dashboard Accessible**
   ```bash
   curl -sk https://emqx.dankehidayat.my.id/dashboard/login | head -10
   ```

### Performance Tests

1. **Response Times**
   ```bash
   curl -w "@curl-format.txt" -o /dev/null -s https://selene.dankehidayat.my.id/api/v1/auth/status
   ```

2. **API Throughput**
   ```bash
   ab -n 100 -c 10 https://selene.dankehidayat.my.id/api/v1/auth/login
   ```

### Security Audit

1. **TLS Configuration**
   ```bash
   openssl s_client -connect selene.dankehidayat.my.id:443 -servername selene.dankehidayat.my.id
   ```

2. **CORS Headers**
   ```bash
   curl -sk -I https://selene.dankehidayat.my.id/api/v1/auth/status | grep -i access-control
   ```

3. **Security Headers**
   ```bash
   curl -sk -I https://selene.dankehidayat.my.id | grep -iE "strict.*transport|x-frame|x-content-type"
   ```

---

## Monitoring Links

After successful deployment, bookmark these URLs:

- **Selene App**: https://selene.dankehidayat.my.id
- **MQTT Dashboard**: https://emqx.dankehidayat.my.id/dashboard/login
- **Monitoring (if enabled)**: http://localhost:9090
- **Logs (local)**: `docker compose logs -f`

---

**Document Version:** 2.0.0  
**Last Updated:** 2026-08-08  
**Maintenance Window:** Weekly Sundays 02:00-04:00 UTC  
**On-Call Rotation:** Engineering team on-call schedule
