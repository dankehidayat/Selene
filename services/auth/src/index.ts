/**
 * Selene Auth Microservice (v1 API)
 * Port 3009 — register/login, 2FA, sessions, profile, admin, notifications.
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";
import { getJwks } from "@selene/shared/jwt/v2";
import { registerAuthRoutes } from "./routes/auth";
import { registerMeRoutes } from "./routes/me";
import { registerTwoFactorRoutes } from "./routes/twoFactor";
import { registerAdminRoutes, registerAdminStats, registerToggleActive } from "./routes/admin";
import { registerMiscRoutes } from "./routes/misc";
import { errorEnvelope } from "./envelope";
import { prisma } from "./db";

const port = Number(process.env.AUTH_PORT || SERVICE_PORTS.auth);

const app = Fastify({ logger: true });

// Global error → envelope (contract: { error: { code, message, ... } })
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  const code = status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
  return errorEnvelope(reply, status, code, error.message || "Internal server error");
});

app.register(registerAuthRoutes);
app.register(registerMeRoutes);
app.register(registerTwoFactorRoutes);
app.register(registerAdminRoutes);
app.register(registerAdminStats);
app.register(registerToggleActive);
app.register(registerMiscRoutes);

// Public health check
app.get("/health", async () => {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "unreachable";
    app.log.error({ error }, "health: db check failed");
  }
  return {
    status: database === "ok" ? "ok" : "degraded",
    service: "selene-auth",
    version: "v2",
    port,
    jwtAlgorithm: "EdDSA (Ed25519)",
    database,
    timestamp: new Date().toISOString(),
  };
});

// Public JWKS for verifying access token signatures
app.get("/.well-known/jwks.json", async () => getJwks());

await app.listen({ port, host: "0.0.0.0" });
console.log(`[auth] SELENE v1 API listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - JWKS:   http://localhost:${port}/.well-known/jwks.json`);