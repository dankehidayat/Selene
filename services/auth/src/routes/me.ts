import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { hashPassword, comparePassword, isValidPassword } from "../password";
import { revokeAllUserSessions } from "../sessions";
import { authenticate } from "../middleware";
import { badRequest, unauthorized, notFound } from "../envelope";

function profileOf(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  totpEnabled: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    twoFactorEnabled: user.totpEnabled,
  };
}

export async function registerMeRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        totpEnabled: true,
      },
    });
    if (!user) return notFound(reply, "User not found");
    return { user: profileOf(user) };
  });

  app.patch("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const { name } = (request.body ?? {}) as { name?: string };
    if (typeof name !== "string" || name.trim().length > 100) {
      return badRequest(reply, "name must be a string of at most 100 characters");
    }
    const user = await prisma.user.update({
      where: { id: request.userId },
      data: { name: name.trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        totpEnabled: true,
      },
    });
    return { user: profileOf(user) };
  });

  app.post(
    "/me/password",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { currentPassword, newPassword } = (request.body ?? {}) as {
        currentPassword?: string;
        newPassword?: string;
      };
      if (!currentPassword || !newPassword) {
        return badRequest(reply, "currentPassword and newPassword are required");
      }
      if (!isValidPassword(newPassword)) {
        return badRequest(reply, "Password must be at least 6 characters");
      }
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user) return notFound(reply, "User not found");

      const ok = await comparePassword(currentPassword, user.password);
      if (!ok) return unauthorized(reply, "Current password is incorrect");

      const hashed = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, passwordChangedAt: new Date() },
      });
      await revokeAllUserSessions(user.id);
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "security",
          title: "Password changed",
          message:
            "Your password was changed. All other devices were signed out.",
        },
      });
      return reply.code(204).send();
    },
  );
}