# Selene Admin Recovery Guide

## IMMEDIATE FIX (Recommended)

### Step 1: Reset Admin Role via Direct Database Command

Run on your VPS terminal:

```bash
docker exec selene-db-postgres psql -U selene_admin -d selene << 'SQL'
BEGIN;
UPDATE "User" 
SET role = 'ADMIN', 
    isActive = true, 
    updatedAt = NOW(),
    "passwordChangedAt" = NOW()
WHERE email = 'dnk.hidayat@gmail.com';

-- Verify the change
SELECT id, email, role FROM "User" WHERE email = 'dnk.hidayat@gmail.com';

COMMIT;
SQL
```

### Step 2: Re-login to Get Fresh JWT Token

After database update is confirmed, logout and login again:

```bash
curl -sk -X POST https://selene.dankehidayat.my.id/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dnk.hidayat@gmail.com","password":"liebling131001"}' | jq '.user.role'
```

Expected output: `"ADMIN"`

### Step 3: Access Dashboard

Open browser: `https://selene.dankehidayat.my.id/dashboard`

---

## WHY THIS APPROACH?

### Security Analysis

**Direct SQL Update Advantages:**
- ✅ Bypasses all routing/API issues completely
- ✅ No security vulnerabilities created  
- ✅ Works regardless of backend state
- ✅ Permanent fix with immediate effect
- ✅ Audit trail exists in PostgreSQL transaction logs

**Self-Elevation API Disadvantages (Current State):**
- ❌ Requires working Caddy routing (currently broken)
- ❌ Creates potential privilege escalation vulnerability
- ❌ Needs additional security layers (2FA, emails, logging)
- ❌ Complex implementation vs direct SQL approach

### When to Use Each Approach

| Scenario | Recommended Method |
|----------|-------------------|
| **Immediate admin recovery** | Direct SQL UPDATE ✅ |
| **Ongoing admin management** | API endpoint with controls ⚠️ |
| **Multi-admin environments** | Full self-service portal 📋 |
| **Enterprise deployments** | MFA + audit logging + approval workflow 🔒 |

---

## ROOT CAUSE DIAGNOSIS

### What Went Wrong

Your `/api/admin/*` requests were being misrouted by Caddy:

**Actual Flow:**
```
Request → selene.dankehidayat.my.id/api/admin/users/:id/role
        ↓
Caddy config checks routes...
        ↓
No /api/admin/* route found → defaults to frontend proxy
        ↓
Frontend returns HTML page (404 error in HTML form)
        ↓
Backend (localhost:8787) NEVER sees the request
```

**Expected Flow:**
```
Request → selene.dankehidayat.my.id/api/admin/users/:id/role
        ↓
Caddy should match /api/admin/* route
        ↓
Reverse proxy to localhost:8787 (backend monolith)
        ↓
Fastify handles PATCH request
        ↓
Returns JSON response with updated user role
```

### Missing Caddy Route Configuration

Your Caddyfile needs these routes added BEFORE the catch-all frontend handler:

```caddyfile
# ... existing microservice routes ...

# === MISSING: Add these lines ===
handle /api/admin/* {
    reverse_proxy localhost:8787
}

handle /api/auth/me {
    reverse_proxy localhost:8787
}

# Frontend SPA handling MUST come LAST
rewrite * /{path}
handle * {
    reverse_proxy localhost:4173
}
```

---

## VERIFICATION COMMANDS

After applying the fix, run these to confirm success:

```bash
# Check database shows ADMIN role
docker exec selene-db-postgres psql -U selene_admin -d selene \
  -c "SELECT id, email, role, \"updatedAt\" FROM \"User\" WHERE email='dnk.hidayat@gmail.com';"

# Test fresh JWT has correct role
TOKEN=$(curl -sk https://selene.dankehidayat.my.id/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"dnk.hidayat@gmail.com","password":"liebling131001"}' | jq -r '.token')

echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# Should show: "role": "ADMIN"
```

---

## FUTURE ENHANCEMENTS (Optional)

For production-ready self-service admin elevation:

1. **Add Rate Limiting**: Max 5 attempts per hour
2. **Require 2FA Confirmation**: Enforce TOTP during elevation
3. **Email Verification**: Send confirmation link before making changes
4. **Audit Logging**: Record IP, timestamp, old/new roles to database
5. **Time-Limited Tokens**: Only allow elevation within 30 days of account creation

These require implementing secure endpoints in `apps/backend/src/routes/admin.ts` with proper middleware protections.

For now, direct SQL remains the most reliable method.

---

## Troubleshooting

### Issue: SQL update fails silently
**Solution**: Check PostgreSQL transaction isolation level:
```bash
docker exec selene-db-postgres psql -U selene_admin -d selene \
  -c "SHOW default_transaction_read_only;"
```
If "on", restart container or connect to write-enabled instance.

### Issue: Login still shows USER after DB update
**Cause**: JWT token cached old role value  
**Fix**: Clear browser cookies and re-login

### Issue: Cannot find /api/admin/* routes in backend
**Diagnosis**: Check if monolith is running:
```bash
docker ps --filter "name=monolith"
curl http://localhost:8787/api/admin/stats | jq .
```

---

## Summary

✅ **Recommended Solution**: Direct SQL UPDATE command
- Fastest recovery (seconds)
- Most secure (no new attack surface)
- Production-proven method
- No code changes required

⚠️ **Alternative**: Implement secure self-elevation API endpoint
- More complex but scalable
- Better for multi-admin teams
- Requires additional security controls
- Can be implemented later as Phase 2

Both paths lead to same result: restored admin access!
