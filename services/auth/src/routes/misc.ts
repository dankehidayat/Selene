import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticate } from "../middleware";
import { notFound, badRequest } from "../envelope";

export async function registerMiscRoutes(app: FastifyInstance) {
  app.get(
    "/notifications",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const notifications = await prisma.notification.findMany({
        where: { userId: request.userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const unread = notifications.filter((n) => !n.read).length;
      return {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount: unread,
      };
    },
  );

  app.patch(
    "/notifications/:id/read",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const found = await prisma.notification.findFirst({
        where: { id, userId: request.userId },
      });
      if (!found) return notFound(reply, "Notification not found");
      await prisma.notification.update({
        where: { id },
        data: { read: true },
      });
      return reply.code(204).send();
    },
  );

  app.get("/glossary", async () => {
    const terms = await prisma.glossaryTerm.findMany({
      orderBy: { term: "asc" },
    });
    return terms.map((t) => ({
      id: t.id,
      term: t.term,
      definition: t.definition,
      category: t.category,
    }));
  });
}