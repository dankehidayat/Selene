// apps/backend/src/types/fastify.d.ts
import "fastify";

declare module "fastify" {
  interface FastifySchema {
    description?: string;
    summary?: string;
    tags?: string[];
    operationId?: string;
    security?: Array<{ [key: string]: string[] }>;
  }
}
