# Administrator Role Elevation — Security Protocol

**Owner:** Danke Hidayat (sole maintainer)
**Last Updated:** 2026-08-14
**Status:** Published
**Type:** Specification
**Target Environment:** Production

---

> **Reference implementation:** The monolith (`apps/backend/src/routes/admin.ts`) implements all six security layers below. The elevation endpoint is `PATCH /api/admin/users/:id/role`. Prisma models (`ConfirmationCode`, `RateLimitState`, `RoleChangeAudit`) live in the monolith's schema (not `services/auth`).
>
> Two honest notes: (1) the **TOTP verification** in the elevation path is a **placeholder** — it checks the secret exists but does not actually verify the code (see section 3). (2) The **code-email sender** is `apps/backend/src/mail.ts` → `sendCodeEmail` (always-on for self-elevation, fire-and-forget).

## Context

The `PATCH /api/admin/users/:id/role` endpoint handles both admin-managing-other-users and self-elevation (a user promoting themselves). Self-elevation runs through six security layers; admin-to-other changes only require a valid admin JWT.

## Guiding principles

- **Defense in depth** — no single factor grants a role change.
- **Least privilege** — elevation is the highest-risk admin action; it gets the strictest path.
- **Auditability** — every attempt is recorded, success or failure.
- **Reversibility** — elevation never costs the account permanent access.

## Endpoint schema

`apps/backend/src/routes/admin.ts:145-162`:

```
PATCH /api/admin/users/:id/role
Auth: Bearer token (admin)
Body: { role: "USER" | "ADMIN", totpCode?, confirmationCode? }
```

The schema requires only `role`. For **self-elevation**, the handler checks that `totpCode` and `confirmationCode` are present (400 if missing). For **admin-to-other**, no extra fields are required.

## Security layers (self-elevation only)

### 1. Account age validation (≥ 24 h)

- Blocks immediate post-registration escalation.
- Checks `User.createdAt` vs `MIN_ACCOUNT_AGE_MS` (24 hours) before any self-elevation attempt.

- **Status: Implemented** — `admin.ts:217-222` enforces this.

### 2. Rate limiting (5 attempts / hour / user)

- Maximum 5 elevation attempts per hour (`RATE_LIMIT_MAX_ATTEMPTS = 5`).
- Database-tracked counter via `RateLimitState` (Prisma model), unique on `(userId, action)`.
- Expired entries reset automatically on the next attempt.

- **Status: Implemented** — `admin.ts:235-313` enforces. Exceeding → `429`. Rate-limit counter incremented on each failed TOTP or confirmation-code check.

### 3. Two-factor authentication (TOTP)

- The user's TOTP secret is loaded. If it exists, `totpValid = true` is set **without actually verifying the provided code** (`// TODO: Decrypt and verify TOTP code`).
- Falls through to backup codes if the secret read throws.
- ⚠️ **This is a known placeholder.** The login flow (`/api/auth/login/2fa`) does real TOTP verification, but the elevation endpoint does not call it yet.

- **Status: Partial** — the check exists but does not cryptographically verify the code.

### 4. Email confirmation

- A new 8-hex-char confirmation code is generated (`crypto.randomBytes(4).toString("hex")`).
- **Emailed** via `apps/backend/src/mail.ts` → `sendCodeEmail` (calls our `emailTemplates.ts` code-email template: large code hero, 10-min expiry).
- Sent fire-and-forget (`.catch()` on mail error; never blocks the elevation flow).
- The SHA-256 hash of the NEW code is stored in `ConfirmationCode` (10-min TTL, `purpose: "role_elevation"`).
- The user's **provided** confirmation code is validated against stored, unconsumed, unexpired hashes with the same purpose.
- On match: consumed + elevation proceeds.
- ⚠️ **Flow note:** The request generates a new code (and emails it) but validates the *provided* code. In practice this means: first request fails the provided-code check (no prior code exists) while the email fires with the new code; second request succeeds.

- **Status: Implemented** — `admin.ts:315-382` + `mail.ts:sendCodeEmail`. Always-on for self-elevation (no env var gate).

### 5. Comprehensive audit logging

- Records: IP, user-agent, actor/target, timestamps, method (always `"api"`).
- Audit entry created on every successful self-elevation via `RoleChangeAudit` Prisma model.

- **Status: Implemented** — `admin.ts:401-414`.

### 6. Session invalidation

- On successful elevation, `passwordChangedAt` is set to `now`, which invalidates ALL existing JWTs (the `authenticate` middleware checks `payload.iat < passwordChangedAt` on every request; 2 s skew tolerance).
- The user's `loginHistory` rows are also deleted.

- **Status: Implemented** — `admin.ts:385-419`.

## Admin-to-other role changes

When a user with role `ADMIN` changes another user's role (neither the target nor the actor are the same person): no 2FA, no confirmation code, no account-age check. The role is updated directly (L438-458). The endpoint returns `{ user }`.

Self-demotion (`id === me && role !== "ADMIN"`) is blocked with `403`.

## Error handling (shipped contract)

| HTTP | Problem |
|------|---------|
| 400 | Missing `totpCode` or `confirmationCode` for self-elevation; account too new; 2FA not enabled |
| 401 | Invalid TOTP or confirmation code |
| 403 | Self-demotion not allowed |
| 409 | Account already has admin privileges |
| 429 | Rate limit exceeded — wait before retrying |

## Required Prisma models (live in the monolith schema)

These models exist in `apps/backend/prisma/schema.prisma`:

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

## Testing checklist

- [x] Account age ≥ 24 h enforced
- [x] Rate limiting blocks after 5 failed attempts
- [ ] TOTP verification actually validates the code (currently a placeholder — see section 3)
- [x] Confirmation-code email is sent (fire-and-forget, always-on)
- [x] Confirmation-code validation works (provided code vs stored hash)
- [x] Audit logs record all attempts
- [x] Sessions are invalidated after a successful elevation
- [x] Admin-to-other role changes work without 2FA/confirmation
- [x] Self-demotion is blocked