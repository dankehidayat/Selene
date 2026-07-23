import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import {
  authenticate,
  requireAdmin,
  type AuthenticatedRequest,
} from "../middleware/auth";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireAdmin);

  // List all users
  app.get(
    "/api/admin/users",
    {
      schema: {
        description: "List all users with search, filter, and pagination",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            search: { type: "string" },
            role: { type: "string", enum: ["USER", "ADMIN"] },
            limit: { type: "string", default: "20" },
            offset: { type: "string", default: "0" },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as {
        search?: string;
        role?: string;
        limit?: string;
        offset?: string;
      };
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Number(query.offset) || 0;

      const where: any = {};
      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
        ];
      }
      if (query.role && ["USER", "ADMIN"].includes(query.role)) {
        where.role = query.role;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { loginHistory: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, limit, offset };
    },
  );

  // Get single user
  app.get(
    "/api/admin/users/:id",
    {
      schema: {
        description: "Get user details with login history",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          loginHistory: {
            take: 10,
            orderBy: { createdAt: "desc" },
            select: { id: true, ip: true, userAgent: true, createdAt: true },
          },
        },
      });

      if (!user) return { error: "User not found" };
      return { user };
    },
  );

  // Change user role
  app.patch(
    "/api/admin/users/:id/role",
    {
      schema: {
        description: "Change user role",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["role"],
          properties: {
            role: { type: "string", enum: ["USER", "ADMIN"] },
          },
        },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { role } = request.body as { role: "USER" | "ADMIN" };
      const req = request as AuthenticatedRequest;

      if (id === req.userId) {
        return { error: "Cannot change your own role" };
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: { id: true, email: true, name: true, role: true },
      });

      return { user };
    },
  );

  // Toggle user active status
  app.patch(
    "/api/admin/users/:id/toggle-active",
    {
      schema: {
        description: "Enable or disable a user account",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const req = request as AuthenticatedRequest;

      if (id === req.userId) {
        return { error: "Cannot disable your own account" };
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return { error: "User not found" };

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: { id: true, email: true, isActive: true },
      });

      return { user: updated };
    },
  );

  // Delete user
  app.delete(
    "/api/admin/users/:id",
    {
      schema: {
        description: "Permanently delete a user account",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const req = request as AuthenticatedRequest;

      if (id === req.userId) {
        return reply
          .code(400)
          .send({ error: "Cannot delete your own account" });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      await prisma.user.delete({ where: { id } });

      return { success: true, message: `User ${user.email} deleted` };
    },
  );

  // System stats
  app.get(
    "/api/admin/stats",
    {
      schema: {
        description: "Get system statistics",
        tags: ["Admin"],
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const [totalUsers, activeUsers, adminUsers, totalLogins] =
        await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { isActive: true } }),
          prisma.user.count({ where: { role: "ADMIN" } }),
          prisma.loginHistory.count(),
        ]);

      return { totalUsers, activeUsers, adminUsers, totalLogins };
    },
  );
}
