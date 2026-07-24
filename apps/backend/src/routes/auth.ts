import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../db";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generatePending2faToken,
  generateSetup2faToken,
  extractTokenFromHeader,
  verifyToken,
} from "../auth";
import { sendPasswordResetEmail } from "../mail";
import {
  encryptTotpSecret,
  decryptTotpSecret,
  generateTotpSecret,
  totpUri,
  verifyTotpCode,
  generateBackupCodes,
  consumeBackupCode,
} from "../totp";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_RESET_MSG =
  "If an account exists for that email, we sent a reset link.";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function completeLogin(
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    totpEnabled?: boolean;
  },
  request: { ip?: string; headers: Record<string, unknown> },
) {
  const ip =
    request.ip || String(request.headers["x-forwarded-for"] || "unknown");
  const userAgent = String(request.headers["user-agent"] || "unknown");

  await prisma.loginHistory.create({
    data: { userId: user.id, ip, userAgent },
  });

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const recentNotification = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      type: "security",
      title: "New login detected",
      createdAt: { gte: sixHoursAgo },
    },
  });

  if (!recentNotification) {
    const browser = userAgent.includes("Firefox")
      ? "Firefox"
      : userAgent.includes("Edg")
        ? "Edge"
        : userAgent.includes("Chrome")
          ? "Chrome"
          : userAgent.includes("Safari")
            ? "Safari"
            : "a browser";

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "security",
        title: "New login detected",
        message: `New sign-in from ${browser}. If this wasn't you, change your password.`,
      },
    });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    purpose: "session",
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      totpEnabled: Boolean(user.totpEnabled),
    },
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  // Register
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, name } = request.body as {
      email: string;
      password: string;
      name?: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return reply
        .code(400)
        .send({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      purpose: "session",
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

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        totpEnabled: false,
      },
    };
  });

  // Login (password) — may require 2FA step
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    if (user.totpEnabled && user.totpSecretEnc) {
      const pendingToken = generatePending2faToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      return {
        requires2fa: true,
        pendingToken,
        message: "Enter the code from your authenticator app",
      };
    }

    return completeLogin(user, request);
  });

  // Complete login with TOTP or backup code
  app.post("/api/auth/login/2fa", async (request, reply) => {
    const { pendingToken, code } = request.body as {
      pendingToken: string;
      code: string;
    };

    if (!pendingToken || !code) {
      return reply
        .code(400)
        .send({ error: "pendingToken and code are required" });
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(pendingToken);
    } catch {
      return reply
        .code(401)
        .send({ error: "2FA session expired. Sign in again." });
    }

    if (payload.purpose !== "2fa_pending") {
      return reply.code(401).send({ error: "Invalid 2FA session" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecretEnc) {
      return reply.code(401).send({ error: "Invalid 2FA session" });
    }

    let ok = false;
    try {
      const secret = decryptTotpSecret(user.totpSecretEnc);
      ok = verifyTotpCode(secret, code);
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
      return reply.code(401).send({ error: "Invalid authentication code" });
    }

    return completeLogin(user, request);
  });

  // ── Password reset ──────────────────────────────────────

  app.post("/api/auth/forgot-password", async (request, reply) => {
    const { email } = request.body as { email?: string };
    if (!email) {
      return reply.code(400).send({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      // Invalidate previous unused tokens
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

      try {
        await sendPasswordResetEmail(user.email, raw);
      } catch (err: any) {
        console.error("[auth] forgot-password mail failed:", err?.message);
        return reply
          .code(503)
          .send({ error: "Could not send email. Try again later." });
      }
    }

    return { message: GENERIC_RESET_MSG };
  });

  app.post("/api/auth/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword) {
      return reply
        .code(400)
        .send({ error: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return reply
        .code(400)
        .send({ error: "Password must be at least 6 characters" });
    }

    const tokenHash = hashToken(token);
    const row = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!row) {
      return reply
        .code(400)
        .send({ error: "Invalid or expired reset link" });
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await prisma.notification.create({
      data: {
        userId: row.userId,
        type: "security",
        title: "Password reset",
        message: "Your password was reset via email link.",
      },
    });

    return { message: "Password updated. You can sign in now." };
  });

  // ── 2FA management ──────────────────────────────────────

  app.get("/api/auth/2fa/status", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { totpEnabled: true, totpBackupHashes: true },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      let backupCodesRemaining = 0;
      if (user.totpBackupHashes) {
        try {
          backupCodesRemaining = (
            JSON.parse(user.totpBackupHashes) as string[]
          ).length;
        } catch {
          backupCodesRemaining = 0;
        }
      }

      return {
        enabled: user.totpEnabled,
        backupCodesRemaining,
      };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  /** Start enrollment — returns secret + otpauth URI (and setupToken). */
  app.post("/api/auth/2fa/setup", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (user.totpEnabled) {
        return reply
          .code(400)
          .send({ error: "2FA is already enabled. Disable it first." });
      }

      const secret = generateTotpSecret();
      const uri = totpUri(user.email, secret);
      const setupToken = generateSetup2faToken({
        userId: user.id,
        secret,
      });

      return {
        secret,
        otpauthUrl: uri,
        setupToken,
        issuer: process.env.TOTP_ISSUER || "Selene",
      };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  /** Confirm enrollment with a valid TOTP code. */
  app.post("/api/auth/2fa/enable", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    const { setupToken, code } = request.body as {
      setupToken?: string;
      code?: string;
    };
    if (!setupToken || !code) {
      return reply
        .code(400)
        .send({ error: "setupToken and code are required" });
    }

    try {
      const session = verifyToken(token);
      if (session.purpose && session.purpose !== "session") {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      let setup: ReturnType<typeof verifyToken>;
      try {
        setup = verifyToken(setupToken);
      } catch {
        return reply
          .code(400)
          .send({ error: "Setup expired. Start 2FA setup again." });
      }

      if (
        setup.purpose !== "2fa_setup" ||
        setup.userId !== session.userId ||
        !setup.secret
      ) {
        return reply.code(400).send({ error: "Invalid setup session" });
      }

      if (!verifyTotpCode(setup.secret, code)) {
        return reply.code(400).send({ error: "Invalid code. Try again." });
      }

      const { plain, hashes } = await generateBackupCodes();
      await prisma.user.update({
        where: { id: session.userId },
        data: {
          totpEnabled: true,
          totpSecretEnc: encryptTotpSecret(setup.secret),
          totpBackupHashes: JSON.stringify(hashes),
        },
      });

      await prisma.notification.create({
        data: {
          userId: session.userId,
          type: "security",
          title: "Two-factor authentication enabled",
          message:
            "Your account now requires an authenticator code at sign-in.",
        },
      });

      return {
        enabled: true,
        backupCodes: plain,
        message:
          "2FA enabled. Save these backup codes — they won't be shown again.",
      };
    } catch (err: any) {
      return reply
        .code(400)
        .send({ error: err.message || "Failed to enable 2FA" });
    }
  });

  /** Disable 2FA (password + current TOTP or backup). */
  app.post("/api/auth/2fa/disable", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    const { password, code } = request.body as {
      password?: string;
      code?: string;
    };
    if (!password || !code) {
      return reply
        .code(400)
        .send({ error: "Password and authenticator code are required" });
    }

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });
      if (!user.totpEnabled || !user.totpSecretEnc) {
        return reply.code(400).send({ error: "2FA is not enabled" });
      }

      const pwOk = await comparePassword(password, user.password);
      if (!pwOk) {
        return reply.code(401).send({ error: "Password is incorrect" });
      }

      let codeOk = false;
      try {
        codeOk = verifyTotpCode(decryptTotpSecret(user.totpSecretEnc), code);
      } catch {
        codeOk = false;
      }
      if (!codeOk) {
        const backup = await consumeBackupCode(code, user.totpBackupHashes);
        codeOk = backup.ok;
      }
      if (!codeOk) {
        return reply.code(401).send({ error: "Invalid authentication code" });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          totpEnabled: false,
          totpSecretEnc: null,
          totpBackupHashes: null,
        },
      });

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "security",
          title: "Two-factor authentication disabled",
          message: "2FA was turned off for your account.",
        },
      });

      return { enabled: false, message: "2FA disabled" };
    } catch (err: any) {
      return reply
        .code(400)
        .send({ error: err.message || "Failed to disable 2FA" });
    }
  });

  /** Regenerate backup codes (requires password + TOTP). */
  app.post("/api/auth/2fa/backup-codes", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    const { password, code } = request.body as {
      password?: string;
      code?: string;
    };
    if (!password || !code) {
      return reply
        .code(400)
        .send({ error: "Password and authenticator code are required" });
    }

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user?.totpEnabled || !user.totpSecretEnc) {
        return reply.code(400).send({ error: "2FA is not enabled" });
      }

      if (!(await comparePassword(password, user.password))) {
        return reply.code(401).send({ error: "Password is incorrect" });
      }
      if (!verifyTotpCode(decryptTotpSecret(user.totpSecretEnc), code)) {
        return reply.code(401).send({ error: "Invalid authentication code" });
      }

      const { plain, hashes } = await generateBackupCodes();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpBackupHashes: JSON.stringify(hashes) },
      });

      return {
        backupCodes: plain,
        message: "New backup codes generated. Save them securely.",
      };
    } catch (err: any) {
      return reply
        .code(400)
        .send({ error: err.message || "Failed to regenerate codes" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          totpEnabled: true,
        },
      });

      if (!user) return reply.code(404).send({ error: "User not found" });

      return { user };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Get login history
  app.get("/api/auth/login-history", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const history = await prisma.loginHistory.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, ip: true, userAgent: true, createdAt: true },
      });
      return { history };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Clear all sessions
  app.delete("/api/auth/clear-sessions", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      await prisma.loginHistory.deleteMany({
        where: { userId: payload.userId },
      });

      await prisma.notification.create({
        data: {
          userId: payload.userId,
          type: "security",
          title: "Sessions cleared",
          message:
            "All login sessions have been cleared. You'll need to sign in again.",
        },
      });

      return { success: true };
    } catch (err: any) {
      return reply
        .code(500)
        .send({ error: err.message || "Failed to clear sessions" });
    }
  });

  // Update profile
  app.patch("/api/auth/me", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const { name } = request.body as { name?: string };

      const user = await prisma.user.update({
        where: { id: payload.userId },
        data: { name },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          totpEnabled: true,
        },
      });

      return { user };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Update failed" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: "Both passwords are required" });
      }
      if (newPassword.length < 6) {
        return reply
          .code(400)
          .send({ error: "New password must be at least 6 characters" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(currentPassword, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Current password is incorrect" });

      const hashedPassword = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      await prisma.notification.create({
        data: {
          userId: payload.userId,
          type: "security",
          title: "Password changed",
          message: "Your password has been updated successfully.",
        },
      });

      return { message: "Password changed successfully" };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Change failed" });
    }
  });

  // Change email
  app.post("/api/auth/change-email", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const { newEmail, password } = request.body as {
        newEmail: string;
        password: string;
      };

      if (!newEmail || !password) {
        return reply
          .code(400)
          .send({ error: "New email and password are required" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(password, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Password is incorrect" });

      const existing = await prisma.user.findUnique({
        where: { email: newEmail },
      });
      if (existing)
        return reply.code(409).send({ error: "Email already in use" });

      await prisma.user.update({
        where: { id: payload.userId },
        data: { email: newEmail },
      });

      return { message: "Email changed successfully. Please log in again." };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Change failed" });
    }
  });

  // Delete account
  app.delete("/api/auth/delete-account", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      if (payload.purpose && payload.purpose !== "session") {
        return reply.code(401).send({ error: "Invalid token" });
      }
      const { password } = request.body as { password: string };

      if (!password)
        return reply.code(400).send({ error: "Password is required" });

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(password, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Password is incorrect" });

      await prisma.user.delete({ where: { id: payload.userId } });

      return { message: "Account deleted successfully" };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Delete failed" });
    }
  });
}
