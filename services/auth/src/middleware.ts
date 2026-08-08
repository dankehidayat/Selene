import type { FastifyRequest, FastifyReply } from "fastify";
import {
  verifyAccessToken,
  type AccessTokenPayload,
} from "@selene/shared/jwt/v2";
import { prisma } from "./db";
import { unauthorized, forbidden, internalError } from "./envelope";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    userRole?: "USER" | "ADMIN";
    jti?: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return unauthorized(reply, "Missing or invalid token");
  }
  const token = header.slice(7).trim();
  const ver = await verifyAccessToken(token);
  if (!ver.valid) {
    return unauthorized(reply, "Invalid or expired token");
  }
  const payload = ver.payload as AccessTokenPayload;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      passwordChangedAt: true,
    },
  });
  if (!user || !user.isActive) {
    return unauthorized(reply, "Account not found or disabled");
  }
  if (user.passwordChangedAt && payload.iat) {
    const issuedMs = payload.iat * 1000;
    if (issuedMs < user.passwordChangedAt.getTime() - 2000) {
      return unauthorized(reply, "Session expired. Please sign in again.");
    }
  }

  request.userId = user.id;
  request.userEmail = user.email;
  request.userRole = user.role;
  request.jti = payload.jti;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.userId) {
    return unauthorized(reply, "Authentication required");
  }
  if (request.userRole !== "ADMIN") {
    return forbidden(reply, "Admin access required");
  }
}

export async function getSessionUser(request: FastifyRequest) {
  if (!request.userId) throw new Error("authenticate not run");
  const user = await prisma.user.findUnique({ where: { id: request.userId } });
  if (!user) throw new Error("User not found");
  return user;
}