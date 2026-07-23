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
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Account not found or disabled" });
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
