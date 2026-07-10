// [apps/backend] src/routes/glossary.ts
import type { FastifyInstance } from "fastify";
import { prisma } from "../db";

export async function registerGlossaryRoutes(app: FastifyInstance) {
  // Get all terms
  app.get("/api/glossary", async () => {
    return prisma.glossaryTerm.findMany({ orderBy: { term: "asc" } });
  });

  // Create term
  app.post("/api/glossary", async (request) => {
    const { term, definition, category } = request.body as {
      term: string;
      definition: string;
      category?: string;
    };
    return prisma.glossaryTerm.create({
      data: { term, definition, category: category || "General" },
    });
  });

  // Delete term
  app.delete("/api/glossary/:id", async (request) => {
    const { id } = request.params as { id: string };
    return prisma.glossaryTerm.delete({ where: { id } });
  });
}
