import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../db";
import { decryptTotpSecret, verifyTotpCode, consumeBackupCode } from "../totp";
import { sendElevationCode } from "../mail";
import { authenticate, requireAdmin } from "../middleware";
import {
  forbidden,
  badRequest,
  notFound,
  conflict,
  rateLimited,
  unauthorized,
  internalError,
} from "../envelope";

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_TTL_MS = 60 * 60 * 1000;
const MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;
const CONFIRMATION_CODE_TTL_MS = 10 * 60 * 1000;

/** Optional second factor beyond TOTP; off by default to match the v1 contract. */
function elevationConfirmationEnabled(): boolean {
  return process.env.ELEVATION_CONFIRMATION === "true";
}

async function incrementRateLimit(userId: string, action: string) {
  const existing = await prisma.rateLimitState.findUnique({
    where: { userId_action: { userId, action } },
  });
  if (existing) {
    await prisma.rateLimitState.update({
      where: { userId_action: { userId, action } },
      data: { attempts: existing.attempts + 1, lastAttempt: new Date() },
    });
  } else {
    await prisma.rateLimitState.create({
      data: {
        userId,
        action,
        attempts: 1,
        expiresAt: new Date(Date.now() + RATE_LIMIT_TTL_MS),
      },
    });
  }
}

async function checkRateLimit(
  userId: string,
  action: string,
): Promise<"ok" | "limited"> {
  const entry = await prisma.rateLimitState.findUnique({
    where: { userId_action: { userId, action } },
  });
  if (!entry) return "ok";
  if (Date.now() > entry.expiresAt.getTime()) return "ok";
  if (entry.attempts >= RATE_LIMIT_MAX_ATTEMPTS) return "limited";
  return "ok";
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/users",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const query = request.query as {
        search?: string;
        role?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;

      const where: {
        OR?: { email?: { contains: string; mode: "insensitive" }; name?: { contains: string; mode: "insensitive" } }[];
        role?: "USER" | "ADMIN";
      } = {};
      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
        ];
      }
      if (query.role === "USER" || query.role === "ADMIN") {
        where.role = query.role;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            totpEnabled: true,
            _count: { select: { loginHistory: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
          twoFactorEnabled: u.totpEnabled,
          loginCount: u._count.loginHistory,
        })),
        total,
      };
    },
  );

  // ── Role change (self-elevation w/ security layers; admin→others) ──
  app.patch(
    "/admin/users/:id/role",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { role, totpCode } = (request.body ?? {}) as {
        role?: string;
        totpCode?: string;
      };

      if (role !== "USER" && role !== "ADMIN") {
        return badRequest(reply, "role must be USER or ADMIN");
      }

      const actorId = request.userId!;
      const action = "role_elevation";

      if (id === actorId && role === "ADMIN") {
        try {
          const existing = await prisma.user.findUnique({ where: { id } });
          if (!existing) return notFound(reply, "Account not found");
          if (existing.role === "ADMIN") {
            return conflict(reply, "Account already has administrator privileges");
          }
          const accountAge = Date.now() - existing.createdAt.getTime();
          if (accountAge < MIN_ACCOUNT_AGE_MS) {
            return forbidden(
              reply,
              "Account must be older than 24 hours before elevation",
            );
          }
          const rl = await checkRateLimit(actorId, action);
          if (rl === "limited") {
            return rateLimited(
              reply,
              "Rate limit exceeded. Please wait before attempting again",
            );
          }
          if (!existing.totpEnabled) {
            return badRequest(
              reply,
              "Two-factor authentication must be enabled for administrative role elevation",
            );
          }

          // Verify admin's TOTP code
          const totp = await verifyTotp(actorId, totpCode, action);
          if (!totp.ok) {
            await incrementRateLimit(actorId, action);
            return unauthorized(reply, totp.reason ?? "Invalid 2FA code");
          }

          // Optional email confirmation (security spec, off by default)
          if (elevationConfirmationEnabled()) {
            const provided = (request.body as { confirmationCode?: string })
              .confirmationCode;
            if (!provided) {
              const plain = crypto.randomBytes(4).toString("hex");
              const hashed = crypto
                .createHash("sha256")
                .update(plain)
                .digest("hex");
              await prisma.confirmationCode.deleteMany({
                where: { userId: actorId, purpose: action },
              });
              await prisma.confirmationCode.create({
                data: {
                  userId: actorId,
                  code: hashed,
                  purpose: action,
                  expiresAt: new Date(Date.now() + CONFIRMATION_CODE_TTL_MS),
                },
              });
              const sent = await sendElevationCode(existing.email, plain);
              if (!sent.ok) {
                console.error("[auth] elevation mail failed:", sent.error);
              }
              return {
                step: "confirmation",
                message: "A confirmation code was sent to your email.",
              };
            }
            const valid = await prisma.confirmationCode.findFirst({
              where: {
                userId: actorId,
                purpose: action,
                consumed: false,
                code: crypto
                  .createHash("sha256")
                  .update(provided)
                  .digest("hex"),
                expiresAt: { gt: new Date() },
              },
            });
            if (!valid) {
              await incrementRateLimit(actorId, action);
              return unauthorized(reply, "Invalid or expired confirmation code");
            }
            await prisma.confirmationCode.update({
              where: { id: valid.id },
              data: { consumed: true },
            });
          }

          const updated = await prisma.user.update({
            where: { id },
            data: { role: "ADMIN", passwordChangedAt: new Date() },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
              totpEnabled: true,
            },
          });

          await prisma.roleChangeAudit.create({
            data: {
              userId: id,
              actorId,
              actorRole: request.userRole,
              targetEmail: updated.email,
              oldRole: "USER",
              newRole: "ADMIN",
              ipAddress: request.ip ?? undefined,
              userAgent: String(request.headers["user-agent"]),
              method: "api",
            },
          });
          await prisma.refreshSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });

          return {
            user: {
              id: updated.id,
              email: updated.email,
              name: updated.name,
              role: updated.role,
              isActive: updated.isActive,
              createdAt: updated.createdAt.toISOString(),
              twoFactorEnabled: updated.totpEnabled,
            },
            message: "Administrator role has been assigned",
            requiresRelogin: true,
          };
        } catch (error) {
          console.error("[error] Self-elevation failed:", error);
          return internalError(
            reply,
            "Elevation process failed. Contact system administrator.",
          );
        }
      }

      // Admin managing another user (demotion requires no elevation layers)
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return notFound(reply, "User not found");
      if (target.id === actorId) {
        return badRequest(reply, "Use role elevation flow for your own account");
      }
      if (request.userRole !== "ADMIN") {
        return forbidden(reply, "Administrator access required for this operation");
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          totpEnabled: true,
        },
      });
      await prisma.roleChangeAudit.create({
        data: {
          userId: id,
          actorId,
          actorRole: request.userRole,
          targetEmail: updated.email,
          oldRole: target.role,
          newRole: role,
          ipAddress: request.ip ?? undefined,
          userAgent: String(request.headers["user-agent"]),
          method: "api",
        },
      });
      return {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          twoFactorEnabled: updated.totpEnabled,
        },
      };
    },
  );
}

// ── Admin Stats ───────────────────────────────────────────────
export async function registerAdminStats(app: FastifyInstance) {
  app.get(
    "/admin/stats",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const [totalUsers, activeUsers, adminUsers, totalLogins] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.loginHistory.count(),
      ]);

      return {
        totalUsers,
        activeUsers,
        adminUsers,
        totalLogins,
      };
    },
  );
}

// ── Toggle User Active ───────────────────────────────────────
export async function registerToggleActive(app: FastifyInstance) {
  app.patch(
    "/admin/users/:id/toggle-active",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return notFound(reply, "User not found");
      if (user.id === request.userId!) {
        return badRequest(reply, "Cannot toggle your own active status");
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          totpEnabled: true,
        },
      });

      return {
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          twoFactorEnabled: updated.totpEnabled,
        },
      };
    },
  );
}

async function verifyTotp(
  actorId: string,
  code: string | undefined,
  action: string,
): Promise<{ ok: boolean; reason?: string }> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { totpSecretEnc: true, totpBackupHashes: true },
  });
  if (!actor?.totpSecretEnc) {
    return { ok: false, reason: "TOTP secret not found" };
  }
  if (!code) return { ok: false, reason: "totpCode is required" };
  let ok = false;
  try {
    ok = verifyTotpCode(decryptTotpSecret(actor.totpSecretEnc), code);
  } catch {
    ok = false;
  }
  if (!ok) {
    const backup = await consumeBackupCode(code, actor.totpBackupHashes);
    if (backup.ok) {
      ok = true;
      await prisma.user.update({
        where: { id: actorId },
        data: { totpBackupHashes: backup.remainingHashes },
      });
    }
  }
  return ok ? { ok: true } : { ok: false, reason: "Invalid 2FA code" };
}