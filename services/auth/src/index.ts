/**
 * Selene auth service (port 3009)
 * Phase 2 microservices scaffold
 * Routes requests to monolith backend until domain logic extraction complete
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.AUTH_PORT ?? SERVICE_PORTS.auth);
const MONOLITH_PORT = 8787; // Backend monolith port
const app = Fastify({ logger: true });

// Health check (public)
app.get("/health", async () => ({
  status: "ok",
  service: "selene-auth",
  version: "v2",
  port,
  jwtAlgorithm: "EdDSA (Ed25519)",
  ready: true,
  timestamp: new Date().toISOString(),
}));

// Service status
app.get("/api/auth/status", async () => ({
  service: "selene-auth",
  ready: true,
  phase: "Phase 2 - Forwards to monolith backend",
  migrationNote: "Domain logic extracted in later phases",
}));

// Catch-all: Forward all other /api/auth/* requests to monolith backend
// This includes: register, login, profile, sessions, 2fa, etc.
app.setNotFoundHandler(async (request, reply) => {
  const { hostname, url } = request;
  
  // Only forward auth-related routes to backend
  if (url?.startsWith("/api/auth/") || 
      url?.startsWith("/api/v1/auth/") ||
      url === "/api/admin/" ||
      url?.startsWith("/api/admin/")) {
    
    return reply.proxy(`http://localhost:${MONOLITH_PORT}`, {
      prefix: "/",
      upstreamRewrite: (path) => path,
    });
  }
  
  // Return 404 for non-auth routes
  return reply.code(404).send({ error: "Not found" });
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[auth] SELNE v2 listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Monolith backend forwarded to: localhost:${MONOLITH_PORT}`);
