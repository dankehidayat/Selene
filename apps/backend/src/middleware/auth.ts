import type { FastifyRequest, FastifyReply } from "fastify";
import { extractTokenFromHeader, verifyToken } from "../auth";
import { prisma } from "../db";

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userEmail: string;
  userRole: "USER" | "ADMIN";
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (!token) {
    return reply.code(401).send({ error: "No token provided" });
  }

  try {
    const payload = verifyToken(token);
    if (payload.purpose && payload.purpose !== "session") {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        passwordChangedAt: true,
      },
    });

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Account not found or disabled" });
    }

    // Invalidate sessions issued before a password reset/change
    if (user.passwordChangedAt && payload.iat) {
      const issuedMs = payload.iat * 1000;
      // 2s skew tolerance
      if (issuedMs < user.passwordChangedAt.getTime() - 2000) {
        return reply
          .code(401)
          .send({ error: "Session expired. Please sign in again." });
      }
    }

    (request as AuthenticatedRequest).userId = user.id;
    (request as AuthenticatedRequest).userEmail = user.email;
    (request as AuthenticatedRequest).userRole = user.role as "USER" | "ADMIN";
  } catch {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const req = request as AuthenticatedRequest;
  if (!req.userId) {
    return reply.code(401).send({ error: "Authentication required" });
  }

  if (req.userRole !== "ADMIN") {
    return reply.code(403).send({ error: "Admin access required" });
  }
}
