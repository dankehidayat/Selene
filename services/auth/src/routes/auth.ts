import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../db";
import { hashPassword, comparePassword, isValidPassword } from "../password";
import {
  verifyTotpCode,
  decryptTotpSecret,
  consumeBackupCode,
} from "../totp";
import { sendPasswordResetEmail } from "../mail";
import { signPending2faToken, resolvePending2fa } from "../pending2fa";
import {
  issueSession,
  rotateSession,
  revokeRefreshToken,
  RefreshTokenReuseError,
  RefreshTokenInvalidError,
} from "../sessions";
import {
  badRequest,
  unauthorized,
  conflict,
} from "../envelope";
import { authenticate } from "../middleware";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_RESET_MSG =
  "If an account exists for that email, we sent a reset link.";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function ctxOf(
  request: { ip?: string; headers: Record<string, unknown> },
  userId: string,
) {
  const ip =
    request.ip ||
    String(request.headers["x-forwarded-for"] || "unknown") ||
    "unknown";
  const userAgent = String(request.headers["user-agent"] || "unknown");
  return { userId, ip, userAgent };
}

async function onLogin(ctx: {
  userId: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  await prisma.loginHistory.create({
    data: { userId: ctx.userId, ip: ctx.ip, userAgent: ctx.userAgent },
  });

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: {
      userId: ctx.userId,
      type: "security",
      title: "New login detected",
      createdAt: { gte: sixHoursAgo },
    },
  });
  if (!recent) {
    const ua = ctx.userAgent || "";
    const browser = ua.includes("Firefox")
      ? "Firefox"
      : ua.includes("Edg")
        ? "Edge"
        : ua.includes("Chrome")
          ? "Chrome"
          : ua.includes("Safari")
            ? "Safari"
            : "a browser";
    await prisma.notification.create({
      data: {
        userId: ctx.userId,
        type: "security",
        title: "New login detected",
        message: `New sign-in from ${browser}. If this wasn't you, change your password.`,
      },
    });
  }
}

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  totpEnabled: boolean;
};

function publicUser(u: AuthUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    twoFactorEnabled: u.totpEnabled,
  };
}

async function completeLogin(
  user: AuthUser,
  request: { ip?: string; headers: Record<string, unknown> },
  reply: import("fastify").FastifyReply,
) {
  await onLogin(ctxOf(request, user.id));
  const pair = await issueSession(user.id);
  return reply.send({ ...pair, user: publicUser(user) });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  // ── Register ────────────────────────────────────────────
  app.post("/auth/register", async (request, reply) => {
    const { email, password, name } = request.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !password) {
      return badRequest(reply, "Email and password are required");
    }
    if (!isValidPassword(password)) {
      return badRequest(reply, "Password must be at least 6 characters");
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      return badRequest(reply, "Invalid email address");
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing) {
      return conflict(reply, "Email already registered");
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: normalized, password: hashed, name },
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Welcome to Selene",
        message:
          "Your account has been created. Start monitoring your energy usage.",
      },
    });

    await onLogin({ userId: user.id, ip: clientIp(request), userAgent: ua(request) });
    const pair = await issueSession(user.id);
    return reply.code(201).send({ ...pair, user: publicUser(user) });
  });

  // ── Login ───────────────────────────────────────────────
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = request.body as {
      email?: string;
      password?: string;
    };
    if (!email || !password) {
      return badRequest(reply, "Email and password are required");
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !user.isActive) {
      return unauthorized(reply, "Invalid email or password");
    }
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return unauthorized(reply, "Invalid email or password");
    }

    if (user.totpEnabled && user.totpSecretEnc) {
      const pendingToken = await signPending2faToken(user);
      return { requires2fa: true, pendingToken };
    }

    return completeLogin(user, request, reply);
  });

  // ── Complete 2FA login ──────────────────────────────────
  app.post("/auth/login/2fa", async (request, reply) => {
    const { pendingToken, code } = request.body as {
      pendingToken?: string;
      code?: string;
    };
    if (!pendingToken || !code) {
      return badRequest(reply, "pendingToken and code are required");
    }

    const pending = await resolvePending2fa(pendingToken);
    if (!pending) {
      return unauthorized(reply, "2FA session expired. Sign in again.");
    }
    const user = await prisma.user.findUnique({ where: { id: pending.userId } });
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecretEnc) {
      return unauthorized(reply, "Invalid 2FA session");
    }

    let ok = false;
    try {
      ok = verifyTotpCode(decryptTotpSecret(user.totpSecretEnc), code);
    } catch {
      ok = false;
    }
    if (!ok) {
      const backup = await consumeBackupCode(code, user.totpBackupHashes);
      if (backup.ok) {
        ok = true;
        await prisma.user.update({
          where: { id: user.id },
          data: { totpBackupHashes: backup.remainingHashes },
        });
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "security",
            title: "Backup code used",
            message:
              "A two-factor backup code was used to sign in. Generate new codes if you're running low.",
          },
        });
      }
    }
    if (!ok) {
      return unauthorized(reply, "Invalid authentication code");
    }

    return completeLogin(user, request, reply);
  });

  // ── Refresh rotation ────────────────────────────────────
  app.post("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return badRequest(reply, "refreshToken is required");
    }
    try {
      const pair = await rotateSession(refreshToken);
      return pair;
    } catch (error) {
      if (error instanceof RefreshTokenReuseError) {
        return unauthorized(reply, error.message);
      }
      if (error instanceof RefreshTokenInvalidError) {
        return unauthorized(reply, error.message);
      }
      return unauthorized(reply, "Invalid or expired refresh token");
    }
  });

  // ── Logout ──────────────────────────────────────────────
  app.post(
    "/auth/logout",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = (request.body ?? {}) as { refreshToken?: string };
      if (body.refreshToken) {
        await revokeRefreshToken(body.refreshToken);
      }
      return reply.code(204).send();
    },
  );

  // ── Forgot password ─────────────────────────────────────
  app.post("/auth/forgot-password", async (request, reply) => {
    const { email } = request.body as { email?: string };
    if (!email) {
      return badRequest(reply, "Email is required");
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user && user.isActive) {
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const raw = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      const sent = await sendPasswordResetEmail(user.email, raw);
      if (!sent.ok) {
        console.error("[auth] forgot-password mail failed:", sent.error);
      }
    }
    return { message: GENERIC_RESET_MSG };
  });

  // ── Reset password ──────────────────────────────────────
  app.post("/auth/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as {
      token?: string;
      newPassword?: string;
    };
    if (!token || !newPassword) {
      return badRequest(reply, "Token and new password are required");
    }
    if (!isValidPassword(newPassword)) {
      return badRequest(reply, "Password must be at least 6 characters");
    }
    const row = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!row) {
      return badRequest(reply, "Invalid or expired reset link");
    }
    const hashed = await hashPassword(newPassword);
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { password: hashed, passwordChangedAt: now },
      }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: now } }),
      prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
    await prisma.notification.create({
      data: {
        userId: row.userId,
        type: "security",
        title: "Password reset",
        message:
          "Your password was reset via email link. All other sessions were signed out.",
      },
    });
    return { message: "Password updated. You can sign in now." };
  });
}

function clientIp(request: { ip?: string; headers: Record<string, unknown> }) {
  return request.ip || String(request.headers["x-forwarded-for"] || "unknown");
}
function ua(request: { headers: Record<string, unknown> }) {
  return String(request.headers["user-agent"] || "unknown");
}