import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET || "selene-secret";
const JWT_EXPIRES_IN = "7d";
const PENDING_2FA_EXPIRES = "5m";

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  purpose?: "session" | "2fa_pending" | "2fa_setup";
  /** Seconds since epoch (set by jwt.sign). */
  iat?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    { ...payload, purpose: payload.purpose ?? "session" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/** Short-lived token after password OK, before TOTP. */
export function generatePending2faToken(payload: {
  userId: string;
  email: string;
  role?: string;
}): string {
  return jwt.sign(
    { ...payload, purpose: "2fa_pending" as const },
    JWT_SECRET,
    { expiresIn: PENDING_2FA_EXPIRES },
  );
}

/** Short-lived token holding pending TOTP secret during setup. */
export function generateSetup2faToken(payload: {
  userId: string;
  secret: string;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: "setup",
      purpose: "2fa_setup" as const,
      secret: payload.secret,
    },
    JWT_SECRET,
    { expiresIn: "10m" },
  );
}

export function verifyToken(token: string): JWTPayload & { secret?: string } {
  return jwt.verify(token, JWT_SECRET) as JWTPayload & { secret?: string };
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

