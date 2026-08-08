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

// Catch-all handler for /api/v1/auth/* routes
// Strips /v1 prefix and forwards to monolith backend
app.setNotFoundHandler(async (request, reply) => {
  const url = request.url || "";
  
  // Match v1 prefixed routes and strip them for backend
  if (url.startsWith("/api/v1/auth/")) {
    // Rewrite path from /api/v1/auth/xxx to /api/auth/xxx
    const newPath = url.replace(/^\/api\/v1\//, "/api/");
    
    return reply.proxy(`http://localhost:${MONOLITH_PORT}`, {
      prefix: newPath,
      upstreamRewrite: (path) => path.replace(/^\/api\/v1\//, "/api/"),
    });
  }
  
  // Also handle /api/admin/* routes
  if (url.startsWith("/api/admin/") || url === "/api/admin") {
    return reply.proxy(`http://localhost:${MONOLITH_PORT}`, {
      prefix: url,
    });
  }
  
  // Return 404 for non-auth routes
  return reply.code(404).send({ error: "Not found" });
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[auth] SELNE v2 listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Monolith backend forwarded to: localhost:${MONOLITH_PORT}`);
