import type { FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR"
  | "NOT_FOUND";

export function errorEnvelope(
  reply: FastifyReply,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): FastifyReply {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      request_id: randomUUID(),
    },
  });
}

export function badRequest(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 400, "VALIDATION_ERROR", message);
}

export function notFound(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 404, "NOT_FOUND", message);
}