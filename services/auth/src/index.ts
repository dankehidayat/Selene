/**
 * Selene auth service (port 3001)
 * Scaffold — Phase 2 of modular microservices migration.
 * Full domain logic still lives in apps/backend until Phase 4.
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.AUTH_PORT ?? SERVICE_PORTS.auth);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "auth",
  port,
  note: "Scaffold: extract domain routes from apps/backend in later phases.",
}));

app.get("/api/auth/status", async () => ({
  service: "auth",
  ready: false,
  migration: "Phase 2 scaffold",
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[auth] scaffold listening on :${port}`);
