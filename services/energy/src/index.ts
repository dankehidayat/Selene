/**
 * Selene Energy Microservice
 * Port 3002
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.ENERGY_PORT ?? SERVICE_PORTS.energy);

const app = Fastify({ logger: true });

// Health endpoint
app.get("/health", async () => ({
  status: "ok",
  service: "selene-energy",
  version: "1.0.0",
  port,
}));

// Get latest energy readings
app.get("/api/energy/latest", async (request, reply) => {
  // TODO: Query TimescaleDB for actual energy readings
  return {
    message: "Energy endpoint - data will appear after ingestion starts",
    lastUpdated: new Date().toISOString(),
    sampleData: {
      voltage: 208.1,
      current: 0.247,
      power: 51.5,
      pf: 0.95,
      frequency: 60.0,
      energyKwh: 123.456,
      apparentPower: 54.2,
      reactivePower: 15.3,
    },
  };
});

// Health check compatibility
app.get("/", async () => {
  return {
    service: "selene-energy",
    status: "running",
    uptime: process.uptime(),
  };
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[energy] SELNE v1 API listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Latest: http://localhost:${port}/api/energy/latest`);
