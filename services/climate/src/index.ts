/**
 * Selene Climate Microservice
 * Port 3003
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.CLIMATE_PORT ?? SERVICE_PORTS.climate);

const app = Fastify({ logger: true });

// Health endpoint
app.get("/health", async () => ({
  status: "ok",
  service: "selene-climate",
  version: "1.0.0",
  port,
}));

// Get latest climate readings
app.get("/api/climate/latest", async (request, reply) => {
  // TODO: Query TimescaleDB for actual climate readings
  return {
    message: "Climate endpoint - data will appear after ingestion starts",
    lastUpdated: new Date().toISOString(),
    sampleData: {
      temperature: 29.12,
      humidity: 65.4,
      pressure: 1013.25,
      dewPoint: 21.3,
    },
  };
});

// Health check compatibility
app.get("/", async () => {
  return {
    service: "selene-climate",
    status: "running",
    uptime: process.uptime(),
  };
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[climate] SELNE v1 API listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Latest: http://localhost:${port}/api/climate/latest`);
