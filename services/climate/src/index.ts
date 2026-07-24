/**
 * Selene climate service (port 3003)
 * Scaffold — Phase 2 of modular microservices migration.
 * Full domain logic still lives in apps/backend until Phase 4.
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.CLIMATE_PORT ?? SERVICE_PORTS.climate);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "climate",
  port,
  note: "Scaffold: extract domain routes from apps/backend in later phases.",
}));

app.get("/api/climate/status", async () => ({
  service: "climate",
  ready: false,
  migration: "Phase 2 scaffold",
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[climate] scaffold listening on :${port}`);
