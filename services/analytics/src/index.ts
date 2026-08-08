/**
 * Selene Analytics Microservice (v1 API)
 * Port 3006 — statistical summaries + fuzzy classification.
 */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";
import { registerAnalyticsRoutes } from "./routes";
import { initTimescaleDB, closeTimescaleDB, pingDatabase } from "./db";
import { errorEnvelope } from "./envelope";

const port = Number(process.env.ANALYTICS_PORT || SERVICE_PORTS.analytics);

const app = Fastify({ logger: true });

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
    ? error.statusCode
    : 500;
  const code = status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
  return errorEnvelope(reply, status, code, error.message || "Internal server error");
});

await initTimescaleDB();

app.register(registerAnalyticsRoutes);

app.get("/health", async () => {
  const database = (await pingDatabase()) ? "ok" : "unreachable";
  return {
    status: database === "ok" ? "ok" : "degraded",
    service: "selene-analytics",
    version: "v2",
    port,
    database,
    timestamp: new Date().toISOString(),
  };
});

process.on("SIGINT", async () => {
  await closeTimescaleDB();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeTimescaleDB();
  process.exit(0);
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[analytics] SELENE v1 API listening on :${port}`);
console.log(`  - Health: http://localhost:${port}/health`);