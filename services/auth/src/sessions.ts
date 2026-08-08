import { randomUUID } from "node:crypto";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
} from "@selene/shared/jwt/v2";
import { prisma } from "./db";
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class RefreshTokenReuseError extends Error {
  constructor(message = "Refresh token already used. Security event logged.") {
    super(message);
    this.name = "RefreshTokenReuseError";
  }
}

export class RefreshTokenInvalidError extends Error {
  constructor(message = "Invalid refresh token.") {
    super(message);
    this.name = "RefreshTokenInvalidError";
  }
}

async function signSessionForUser(
  user: { id: string; email: string; role: string },
  sessionId: string,
  familyId: string,
  iat: number,
): Promise<TokenPair> {
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, role: user.role as "USER" | "ADMIN", sid: sessionId },
    { iat },
  );
  const refreshToken = await signRefreshToken(
    { sub: user.id, sid: sessionId, fid: familyId },
    { iat },
  );
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
}

export async function issueSession(
  userId: string,
  opts: { now?: number } = {},
): Promise<TokenPair> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const familyId = randomUUID();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw new RefreshTokenInvalidError("User does not exist");

  const pair = await signSessionForUser(user, sessionId, familyId, now);
  const payload = await verifyRefreshToken(pair.refreshToken);
  if (!payload.valid) throw new Error("Failed to verify issued refresh token");

  await prisma.refreshSession.create({
    data: {
      familyId,
      userId,
      currentJti: payload.payload.jti,
      expiresAt: new Date((now + REFRESH_TOKEN_TTL) * 1000),
    },
  });
  return pair;
}

export async function rotateSession(
  refreshToken: string,
  opts?: { now?: number },
): Promise<TokenPair> {
  const now = opts?.now ?? Math.floor(Date.now() / 1000);
  const ver = await verifyRefreshToken(refreshToken);
  if (!ver.valid) throw new RefreshTokenInvalidError(ver.reason);

  const { sub, sid, fid, jti } = ver.payload;
  const session = await prisma.refreshSession.findUnique({
    where: { familyId: fid },
  });
  if (!session) throw new RefreshTokenInvalidError();
  if (session.revokedAt) throw new RefreshTokenInvalidError();

  if (session.currentJti !== jti) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(now * 1000) },
    });
    throw new RefreshTokenReuseError();
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) throw new RefreshTokenInvalidError();

  const pair = await signSessionForUser(user, sid, fid, now);
  const newPayload = await verifyRefreshToken(pair.refreshToken);
  if (!newPayload.valid) throw new Error("issued refresh token invalid");

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: {
      currentJti: newPayload.payload.jti,
      lastUsedAt: new Date(now * 1000),
    },
  });
  return pair;
}

/** Revoke the family that signed `refreshToken` (logout, session kill). */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const ver = await verifyRefreshToken(refreshToken);
  if (!ver.valid || !ver.payload.fid) return;
  await prisma.refreshSession.updateMany({
    where: { familyId: ver.payload.fid, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every refresh family belonging to the user (clear sessions). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}