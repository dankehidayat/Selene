// apps/backend/src/routes/notifications.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { extractTokenFromHeader, verifyToken } from "../auth";

export async function registerNotificationRoutes(app: FastifyInstance) {
  // Get notifications for current user
  app.get("/api/notifications", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token" });

    try {
      const payload = verifyToken(token);
      const notifications = await prisma.notification.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          read: true,
          createdAt: true,
        },
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: payload.userId, read: false },
      });

      return { notifications, unreadCount };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Mark single notification as read
  app.patch("/api/notifications/:id/read", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token" });

    try {
      const { id } = request.params as { id: string };
      await prisma.notification.update({
        where: { id },
        data: { read: true },
      });
      return { success: true };
    } catch {
      return reply.code(500).send({ error: "Failed" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token" });

    try {
      const payload = verifyToken(token);
      await prisma.notification.updateMany({
        where: { userId: payload.userId, read: false },
        data: { read: true },
      });
      return { success: true };
    } catch {
      return reply.code(500).send({ error: "Failed" });
    }
  });

  // Delete all notifications
  app.delete("/api/notifications", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token" });

    try {
      const payload = verifyToken(token);
      await prisma.notification.deleteMany({
        where: { userId: payload.userId },
      });
      return { success: true };
    } catch {
      return reply.code(500).send({ error: "Failed" });
    }
  });
}
