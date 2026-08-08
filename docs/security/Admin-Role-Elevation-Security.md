# Administrator Role Elevation — Security Protocol (Proposed Design)

> **Status:** Proposed / not yet implemented
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

- **Status: Designed** — requires a schema field only if computed client-side
  is sufficient (recommended: derive from existing `createdAt`; no migration).

### 2. Rate limiting (target: 5 attempts / hour / user)

- Maximum 5 elevation attempts per hour.
- Exponential back-off after repeated failures.
- Database-tracked counter with TTL (see § Prisma models below).

- **Status: Proposed** — a `RateLimitState` model exists in an unmerged draft
  (`schema.prisma` does **not** yet contain it). The v1 auth service will add
  rate limiting as part of its auth hardening milestone.

### 3. Two-factor authentication (TOTP)

- Valid TOTP code mandatory for self-elevation.
- Backup codes accepted as fallback.
- Encrypted secret storage; SHA-based verification.

- **Status: Partially designed** — the monolith already ships TOTP enable /
  disable / login-2FA / backup codes (`/api/auth/2fa/*`, verified in
  `apps/backend/src/routes/auth.ts`). Elevation *requiring* a TOTP re-verify is
  **not** implemented.

### 4. Email confirmation

- One-time confirmation code sent via Resend.
- SHA-256 hashed tokens; 10-minute validity; single-use with consumption flag.

- **Design notes:** reuse the existing mail pipeline in `apps/backend/src/mail.ts`
  (already wired for password reset). Needs a `ConfirmationCode` persistence
  model; not yet implemented.

### 5. Comprehensive audit logging

- Records: IP, user-agent, actor/target, timestamps, method.
- Intended to satisfy GDPR / SOC2 / ISO 27001 review expectations.

- **Status: Proposed** — no `RoleChangeAudit` model exists in
  `apps/backend/prisma/schema.prisma` today.

### 6. Session invalidation

- All devices logged out after a successful elevation.
- Login-history purge + JWT blacklist.
- Automatic session restoration on next login.

- **Status: Proposed.**

## Error handling (target contract)

All elevation errors follow the unified API envelope:

| HTTP | Problem |
|------|---------|
| 400 | Invalid request parameters |
| 401 | Invalid two-factor authentication code |
| 403 | Account too new or not eligible |
| 409 | Account already has admin privileges |
| 429 | Too many attempts — please wait (`Retry-After` header) |

## Required Prisma models (draft — NOT in schema)

```prisma
model RoleChangeAudit {
    id        String   @id @default(cuid())
    userId    String
    targetEmail String
    oldRole   UserRole?
    newRole   UserRole
    ipAddress String?
    userAgent String?
    createdAt DateTime @default(now())
}

model RateLimitState {
    id        String   @id @default(cuid())
    userId    String
    action    String
    attempts  Int      @default(0)
    expiresAt DateTime
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

> **Warning:** adding these models is a **breaking schema change**. It must be
> shipped as a Prisma migration (`bunx prisma migrate add --name admin_elevation`)
> — never `db push` in production without a plan.

## Testing checklist (when implemented)

- [ ] TOTP verification works correctly
- [ ] Email confirmation codes are sent and expire correctly
- [ ] Rate limiting blocks after 5 failed attempts
- [ ] Accounts < 24 h old cannot be elevated
- [ ] Audit logs record all attempts
- [ ] Sessions are invalidated after a successful elevation

## Migration / rollout note

Implementing this spec lands in **Phase B3** of `feat/api-v1-microservices`
(the real `services/auth` replacing the legacy proxy). Layer owners
(auth-service, gateway) may move at different paces; each flip to
**Implemented** must be accompanied by a migration and endpoint tests.