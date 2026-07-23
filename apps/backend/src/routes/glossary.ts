// apps/backend/src/routes/glossary.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db";
import { authenticate, requireAdmin } from "../middleware/auth";

export async function registerGlossaryRoutes(app: FastifyInstance) {
  // Get all terms — public
  app.get("/api/glossary", async () => {
    return prisma.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  });

  // Create term — admin only
  app.post(
    "/api/glossary",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request) => {
      const { term, definition, category } = request.body as {
        term: string;
        definition: string;
        category?: string;
      };
      return prisma.glossaryTerm.create({
        data: { term, definition, category: category || "General" },
      });
    },
  );

  // Delete term — admin only
  app.delete(
    "/api/glossary/:id",
    {
      preHandler: [authenticate, requireAdmin],
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return prisma.glossaryTerm.delete({ where: { id } });
    },
  );
}
