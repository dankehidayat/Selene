/**
 * Selene Auth Microservice (v1 API)
 * Port 3009 - Handles authentication, user management via proxy to monolith
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.AUTH_PORT || SERVICE_PORTS.auth);

// Use container name for inter-service communication within Docker network
const MONOLITH_HOST = process.env.MONOLITH_HOST || "monolith";
const MONOLITH_PORT = process.env.MONOLITH_PORT || "8787";
const MONOLITH_URL = process.env.MONOLITH_URL || `http://${MONOLITH_HOST}:${MONOLITH_PORT}`;

const app = Fastify({ logger: true });

// Public health check
app.get("/health", async () => ({
  status: "ok",
  service: "selene-auth",
  version: "v2",
  port,
  jwtAlgorithm: "EdDSA (Ed25519)",
  ready: true,
  timestamp: new Date().toISOString(),
}));

// Manual proxy handler using native fetch
app.setNotFoundHandler(async (request, reply) => {
  const url = request.url || "";
  
  // Forward /api/v1/auth/* routes
  if (url.startsWith("/api/v1/auth/")) {
    // Strip /v1 prefix to match backend routes
    const backendPath = url.replace(/^\/api\/v1\//, "/api/");
    
    try {
      console.log(`Proxying ${request.method} ${backendPath} to ${MONOLITH_URL}${backendPath}`);
      
      const response = await fetch(`${MONOLITH_URL}${backendPath}`, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...(request.headers.authorization && { authorization: request.headers.authorization }),
        },
        body: ["POST", "PUT", "PATCH"].includes(request.method) 
          ? JSON.stringify(request.body) 
          : undefined,
      });
      
      return reply.code(response.status).header("Content-Type", "application/json").send(await response.json());
    } catch (error) {
      console.error(`Proxy error for ${request.url}:`, error.message);
      return reply.code(502).send({ 
        error: "Backend unavailable", 
        path: `${MONOLITH_URL}${backendPath}`,
        host: MONOLITH_HOST,
        port: MONOLITH_PORT 
      });
    }
  }
  
  // Also handle /api/admin/* routes
  if (url.startsWith("/api/admin/") || url === "/api/admin") {
    try {
      const response = await fetch(`${MONOLITH_URL}${url}`, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...(request.headers.authorization && { authorization: request.headers.authorization }),
        },
        body: ["POST", "PUT", "PATCH"].includes(request.method) 
          ? JSON.stringify(request.body) 
          : undefined,
      });
      
      if (!response.ok) {
        return reply.code(response.status).send(await response.json());
      }
      
      return reply.send(await response.json());
    } catch (error) {
      console.error(`Admin proxy error for ${request.url}:`, error.message);
      return reply.code(502).send({ error: "Backend unavailable" });
    }
  }
  
  return reply.code(404).send({ error: "Not found", path: url });
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[auth] SELNE v1 API listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Monolith Backend URL: ${MONOLITH_URL}`);
console.log(`  - Host: ${MONOLITH_HOST}, Port: ${MONOLITH_PORT}`);
