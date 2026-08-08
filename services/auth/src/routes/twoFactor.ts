import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { comparePassword } from "../password";
import {
  generateTotpSecret,
  totpUri,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  generateBackupCodes,
  consumeBackupCode,
} from "../totp";
import {
  signSetup2faToken,
  resolveSetup2fa,
} from "../pending2fa";
import { authenticate } from "../middleware";
import { badRequest, unauthorized, notFound, internalError } from "../envelope";

export async function registerTwoFactorRoutes(app: FastifyInstance) {
  // ── Status ─────────────────────────────────────────────────
  app.get(
    "/auth/2fa/status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { totpEnabled: true, totpBackupHashes: true },
      });
      if (!user) return notFound(reply, "User not found");
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
      return { enabled: user.totpEnabled, backupCodesRemaining };
    },
  );

  // ── Setup ──────────────────────────────────────────────────
  app.post(
    "/auth/2fa/setup",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
      });
      if (!user) return notFound(reply, "User not found");
      if (user.totpEnabled) {
        return badRequest(reply, "2FA is already enabled. Disable it first.");
      }
      const secret = generateTotpSecret();
      const uri = totpUri(user.email, secret);
      const setupToken = await signSetup2faToken(user.id, secret);
      return {
        secret,
        otpauthUrl: uri,
        setupToken,
        issuer: process.env.TOTP_ISSUER || "Selene",
      };
    },
  );

  // ── Enable (confirm setup code) ────────────────────────────
  app.post(
    "/auth/2fa/enable",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { setupToken, code } = (request.body ?? {}) as {
        setupToken?: string;
        code?: string;
      };
      if (!setupToken || !code) {
        return badRequest(reply, "setupToken and code are required");
      }
      const setup = await resolveSetup2fa(setupToken);
      if (!setup || setup.userId !== request.userId) {
        return badRequest(reply, "Setup expired. Start 2FA setup again.");
      }
      if (!setup.secret) {
        return badRequest(reply, "Invalid setup session");
      }
      if (!verifyTotpCode(setup.secret, code)) {
        return badRequest(reply, "Invalid code. Try again.");
      }

      const { plain, hashes } = await generateBackupCodes();
      await prisma.user.update({
        where: { id: request.userId },
        data: {
          totpEnabled: true,
          totpSecretEnc: encryptTotpSecret(setup.secret),
          totpBackupHashes: JSON.stringify(hashes),
        },
      });
      await prisma.notification.create({
        data: {
          userId: request.userId,
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
    },
  );

  // ── Disable ────────────────────────────────────────────────
  app.post(
    "/auth/2fa/disable",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { password, code } = (request.body ?? {}) as {
        password?: string;
        code?: string;
      };
      if (!password || !code) {
        return badRequest(reply, "Password and authenticator code are required");
      }
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user) return notFound(reply, "User not found");
      if (!user.totpEnabled || !user.totpSecretEnc) {
        return badRequest(reply, "2FA is not enabled");
      }
      const pwOk = await comparePassword(password, user.password);
      if (!pwOk) return unauthorized(reply, "Password is incorrect");

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
      if (!codeOk) return unauthorized(reply, "Invalid authentication code");

      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecretEnc: null, totpBackupHashes: null },
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
    },
  );

  // ── Backup codes ───────────────────────────────────────────
  app.post(
    "/auth/2fa/backup-codes",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { password, code } = (request.body ?? {}) as {
        password?: string;
        code?: string;
      };
      if (!password || !code) {
        return badRequest(reply, "Password and authenticator code are required");
      }
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user?.totpEnabled || !user.totpSecretEnc) {
        return badRequest(reply, "2FA is not enabled");
      }
      if (!(await comparePassword(password, user.password))) {
        return unauthorized(reply, "Password is incorrect");
      }
      if (!verifyTotpCode(decryptTotpSecret(user.totpSecretEnc), code)) {
        return unauthorized(reply, "Invalid authentication code");
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
    },
  );
}