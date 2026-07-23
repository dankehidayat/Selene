import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import {
  hashPassword,
  comparePassword,
  generateToken,
  extractTokenFromHeader,
  verifyToken,
} from "../auth";

export async function registerAuthRoutes(app: FastifyInstance) {
  // Register
  app.post("/api/auth/register", async (request, reply) => {
    const { email, password, name } = request.body as {
      email: string;
      password: string;
      name?: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return reply
        .code(400)
        .send({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Welcome to Selene",
        message:
          "Your account has been created. Start monitoring your energy usage.",
      },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  });

  // Login
  app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const ip =
      request.ip || String(request.headers["x-forwarded-for"] || "unknown");
    const userAgent = String(request.headers["user-agent"] || "unknown");

    await prisma.loginHistory.create({
      data: { userId: user.id, ip, userAgent },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentNotification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "security",
        title: "New login detected",
        createdAt: { gte: sixHoursAgo },
      },
    });

    if (!recentNotification) {
      const browser = userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Edg")
          ? "Edge"
          : userAgent.includes("Chrome")
            ? "Chrome"
            : userAgent.includes("Safari")
              ? "Safari"
              : "a browser";

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "security",
          title: "New login detected",
          message: `New sign-in from ${browser}. If this wasn't you, change your password.`,
        },
      });
    }

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  });

  // Get current user
  app.get("/api/auth/me", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) return reply.code(404).send({ error: "User not found" });

      return { user };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Get login history
  app.get("/api/auth/login-history", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const history = await prisma.loginHistory.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, ip: true, userAgent: true, createdAt: true },
      });
      return { history };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  // Clear all sessions
  app.delete("/api/auth/clear-sessions", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      await prisma.loginHistory.deleteMany({
        where: { userId: payload.userId },
      });

      await prisma.notification.create({
        data: {
          userId: payload.userId,
          type: "security",
          title: "Sessions cleared",
          message:
            "All login sessions have been cleared. You'll need to sign in again.",
        },
      });

      return { success: true };
    } catch (err: any) {
      return reply
        .code(500)
        .send({ error: err.message || "Failed to clear sessions" });
    }
  });

  // Update profile
  app.patch("/api/auth/me", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const { name } = request.body as { name?: string };

      const user = await prisma.user.update({
        where: { id: payload.userId },
        data: { name },
        select: { id: true, email: true, name: true, role: true },
      });

      return { user };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Update failed" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return reply.code(400).send({ error: "Both passwords are required" });
      }
      if (newPassword.length < 6) {
        return reply
          .code(400)
          .send({ error: "New password must be at least 6 characters" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(currentPassword, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Current password is incorrect" });

      const hashedPassword = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: payload.userId },
        data: { password: hashedPassword },
      });

      await prisma.notification.create({
        data: {
          userId: payload.userId,
          type: "security",
          title: "Password changed",
          message: "Your password has been updated successfully.",
        },
      });

      return { message: "Password changed successfully" };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Change failed" });
    }
  });

  // Change email
  app.post("/api/auth/change-email", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const { newEmail, password } = request.body as {
        newEmail: string;
        password: string;
      };

      if (!newEmail || !password) {
        return reply
          .code(400)
          .send({ error: "New email and password are required" });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(password, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Password is incorrect" });

      const existing = await prisma.user.findUnique({
        where: { email: newEmail },
      });
      if (existing)
        return reply.code(409).send({ error: "Email already in use" });

      await prisma.user.update({
        where: { id: payload.userId },
        data: { email: newEmail },
      });

      return { message: "Email changed successfully. Please log in again." };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Change failed" });
    }
  });

  // Delete account
  app.delete("/api/auth/delete-account", async (request, reply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) return reply.code(401).send({ error: "No token provided" });

    try {
      const payload = verifyToken(token);
      const { password } = request.body as { password: string };

      if (!password)
        return reply.code(400).send({ error: "Password is required" });

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
      if (!user) return reply.code(404).send({ error: "User not found" });

      const valid = await comparePassword(password, user.password);
      if (!valid)
        return reply.code(401).send({ error: "Password is incorrect" });

      await prisma.user.delete({ where: { id: payload.userId } });

      return { message: "Account deleted successfully" };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Delete failed" });
    }
  });
}
