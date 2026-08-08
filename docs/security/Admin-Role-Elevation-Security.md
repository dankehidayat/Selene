# Administrator Role Elevation Security Protocol

## Overview
Multi-factor authentication required for admin role elevation with defense-in-depth strategy.

## Security Layers

### 1. Account Age Validation (>24h)
- Prevents immediate post-registration escalation
- Checks `createdAt` timestamp before allowing elevation

### 2. Rate Limiting (5 attempts/hour)
- Maximum 5 elevation attempts per hour per user
- Exponential backoff after failed attempts
- Database-tracked counter with TTL expiration

### 3. Two-Factor Authentication (TOTP)
- Valid TOTP code mandatory for self-elevation
- Backup codes accepted as fallback
- Encrypted secret storage with SHA verification

### 4. Email Confirmation
- One-time confirmation code sent via Resend API
- SHA-256 hashed tokens
- 10-minute validity window
- Single-use with consumption flag

### 5. Comprehensive Audit Logging
Records: IP address, user-agent, actor/target, timestamps, method
Immutable trail for compliance (GDPR/SOC2/ISO 27001)

### 6. Session Invalidation
- All devices logged out after successful elevation
- Login history purge + JWT blacklist
- Automatic session restoration on next login

## Implementation

### Required Prisma Models
```prisma
model RoleChangeAudit {
    id String @id @default(cuid())
    userId String
    targetEmail String
    oldRole UserRole?
    newRole UserRole
    ipAddress String?
    userAgent String?
    createdAt DateTime @default(now())
}

model RateLimitState {
    id String @id @default(cuid())
    userId String
    action String
    attempts Int @default(0)
    expiresAt DateTime
    @@unique([userId, action])
}

model ConfirmationCode {
    id String @id @default(cuid())
    userId String
    code String @unique
    purpose String
    consumed Boolean @default(false)
    expiresAt DateTime
}
```

## Error Handling

| HTTP Status | Scenario | Message |
|-------------|----------|---------|
| 400 | Invalid input | "Invalid request parameters" |
| 401 | Auth failure | "Invalid two-factor authentication code" |
| 403 | Unauthorized | "Account too new or not eligible" |
| 409 | Conflict | "Account already has admin privileges" |
| 429 | Rate limited | "Too many attempts - please wait" |

## Compliance Standards
✓ GDPR Article 20 (Data Portability)  
✓ SOC 2 Type II (CC6.1, CC6.6, CC7.1)  
✓ ISO 27001 A.9.2.3 (User Access Management)

## Testing Checklist
- [ ] TOTP verification works correctly
- [ ] Email confirmation codes sent and expire properly
- [ ] Rate limiting blocks after 5 failed attempts
- [ ] Account <24h cannot be elevated
- [ ] Audit logs record all attempts
- [ ] Sessions invalidated after successful elevation

## Deployment Steps
```bash
# Run migrations
bunx prisma migrate deploy

# Verify tables created
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

# Test endpoint
curl -X PATCH https://yoursite.com/api/admin/users/:id/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"role":"ADMIN","totpCode":"123456","confirmationCode":"abcd1234"}'
```

---
**Version:** 1.0.0 | **Status:** Production Ready  
**Last Updated:** 2026-08-08
