/**
 * Shared JWT helpers for microservices (Phase 2+).
 * Monolith still uses apps/backend/src/middleware/auth.ts; migrate callers gradually.
 */
import jwt from "jsonwebtoken";
import type { JWTPayload, UserRole } from "../types/auth";

const secret = () => process.env.JWT_SECRET || "selene-secret";

export function signToken(
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresIn: string | number = "7d",
): string {
  return jwt.sign(payload, secret(), { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, secret()) as JWTPayload;
}

export function extractBearer(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function isAdmin(role?: UserRole | string): boolean {
  return role === "ADMIN";
}
