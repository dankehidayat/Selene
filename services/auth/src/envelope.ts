import type { FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "TOKEN_REUSE_DETECTED";

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

export function unauthorized(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 401, "UNAUTHORIZED", message);
}

export function forbidden(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 403, "FORBIDDEN", message);
}

export function notFound(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 404, "NOT_FOUND", message);
}

export function conflict(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 409, "CONFLICT", message);
}

export function rateLimited(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 429, "RATE_LIMITED", message);
}

export function internalError(reply: FastifyReply, message: string) {
  return errorEnvelope(reply, 500, "INTERNAL_ERROR", message);
}