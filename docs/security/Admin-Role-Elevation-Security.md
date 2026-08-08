# Administrator Role Elevation — Security Protocol

> **Status:** Implemented in `services/auth` (Phase B3 of
> `feat/api-v1-microservices`). Email-confirmation layer is opt-in via
> `ELEVATION_CONFIRMATION=true`.
> **Version:** 0.1.0
> **Last updated:** 2026-08-09
>
> This document is a **living specification**. Each security layer below is
> described as *designed*. As layers are implemented (in the services/auth
> rewrite, see `feat/api-v1-microservices`), their status line flips to
> **Implemented** and the section is updated to describe the shipped behavior.
> Nothing in this document describes code that exists today until it says
> "Implemented".

## Context

The current auth service (legacy, monolith-era) allows an admin to promote
users via `/api/admin/users/:id/role` with only a valid admin JWT. Self-service
role elevation has **never** shipped. This document specifies the hardening
that role elevation — and privilege changes in general — must receive before
the endpoint is considered production-safe.

## Guiding principles

- **Defense in depth** — no single factor grants a role change.
- **Least privilege** — elevation is the highest-risk admin action; it gets
  the strictest path.
- **Auditability** — every attempt is recorded, success or failure.
- **Reversibility** — elevation never costs the account permanent access.

## Security layers

### 1. Account age validation (≥ 24 h)

- Blocks immediate post-registration escalation.
- Checks `User.createdAt` freshness before any elevation attempt.

- **Status: Implemented** — `services/auth` enforces `MIN_ACCOUNT_AGE_MS`
  (24 h) before self-elevation to ADMIN.

### 2. Rate limiting (target: 5 attempts / hour / user)

- Maximum 5 elevation attempts per hour.
- Exponential back-off after repeated failures.
- Database-tracked counter with TTL (see § Prisma models below).

- **Status: Implemented** — `services/auth/prisma/schema.prisma` adds
  `RateLimitState` (with `unique([userId, action])` and `lastAttempt`);
  `PATCH /admin/users/:id/role` enforces 5 attempts / hour.

### 3. Two-factor authentication (TOTP)

- Valid TOTP code mandatory for self-elevation.
- Backup codes accepted as fallback.
- Encrypted secret storage; SHA-based verification.

- **Status: Implemented** — the auth service re-implements the monolith's
  `/api/auth/2fa/*` (enable / disable / login-2FA / backup codes,
  `services/auth/src/totp.ts`), and self-elevation re-verifies the admin's TOTP
  or backup code before granting ADMIN.

### 4. Email confirmation

- One-time confirmation code sent via Resend.
- SHA-256 hashed tokens; 10-minute validity; single-use with consumption flag.

- **Design notes:** reuse the existing mail pipeline in `services/auth/src/mail.ts`
  (`sendElevationCode`). **Status: Implemented (opt-in)** — `ConfirmationCode`
  persistence exists and the flow runs when `ELEVATION_CONFIRMATION=true`
  (off by default to match the v1 contract's `{ role, totpCode }` body).

### 5. Comprehensive audit logging

- Records: IP, user-agent, actor/target, timestamps, method.
- Intended to satisfy GDPR / SOC2 / ISO 27001 review expectations.

- **Status: Implemented** — `services/auth/prisma/schema.prisma` adds
  `RoleChangeAudit` (with `actorId`, `actorRole`, `method`, IP, UA); both the
  elevation and admin-manages-user paths write an audit row.

### 6. Session invalidation

- All devices logged out after a successful elevation.
- Login-history purge + JWT blacklist.
- Automatic session restoration on next login.

- **Status: Implemented** — elevation revokes all `RefreshSession` families for
  the user (so every issued refresh token is rejected) and bumps
  `passwordChangedAt` to invalidate outstanding access tokens at verify time.

## Error handling (target contract)

All elevation errors follow the unified API envelope:

| HTTP | Problem |
|------|---------|
| 400 | Invalid request parameters |
| 401 | Invalid two-factor authentication code |
| 403 | Account too new or not eligible |
| 409 | Account already has admin privileges |
| 429 | Too many attempts — please wait (`Retry-After` header) |

## Required Prisma models (shipped in `services/auth/prisma/schema.prisma`)

Shipped with the auth-service schema (mirrored table shapes so the service can
share the monolith's Postgres during migration):

```prisma
model RoleChangeAudit {
    id        String   @id @default(cuid())
    userId    String
    actorId   String
    actorRole UserRole?
    targetEmail String
    oldRole   UserRole?
    newRole   UserRole
    ipAddress String?
    userAgent String?
    method    String   @default("api")
    createdAt DateTime @default(now())
}

model RateLimitState {
    id        String   @id @default(cuid())
    userId    String
    action    String
    attempts  Int      @default(0)
    expiresAt DateTime
    lastAttempt DateTime @default(now())
    @@unique([userId, action])
}

model ConfirmationCode {
    id        String   @id @default(cuid())
    userId    String
    code      String   @unique
    purpose   String
    consumed  Boolean  @default(false)
    expiresAt DateTime
}
```

> **Warning:** applying these models to the monolith's schema is a **breaking
> schema change** in production. Ship as a Prisma migration
> (`bunx prisma migrate add --name admin_elevation`) — never `db push` in
> production without a plan.

## Testing checklist (when implemented)

- [x] TOTP verification works correctly
- [ ] Email confirmation codes are sent and expire correctly (opt-in, `ELEVATION_CONFIRMATION=true`)
- [ ] Rate limiting blocks after 5 failed attempts
- [x] Accounts < 24 h old cannot be elevated
- [x] Audit logs record all attempts
- [x] Sessions are invalidated after a successful elevation

## Migration / rollout note

Implementing this spec lands in **Phase B3** of `feat/api-v1-microservices`
(the real `services/auth` replacing the legacy proxy). Layer owners
(auth-service, gateway) may move at different paces; each flip to
**Implemented** must be accompanied by a migration and endpoint tests.