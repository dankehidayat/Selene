/**
 * Selene energy service (port 3002)
 * Scaffold — Phase 2 of modular microservices migration.
 * Full domain logic still lives in apps/backend until Phase 4.
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.ENERGY_PORT ?? SERVICE_PORTS.energy);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "energy",
  port,
  note: "Scaffold: extract domain routes from apps/backend in later phases.",
}));

app.get("/api/energy/status", async () => ({
  service: "energy",
  ready: false,
  migration: "Phase 2 scaffold",
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[energy] scaffold listening on :${port}`);
