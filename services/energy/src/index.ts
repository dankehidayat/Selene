/**
 * Selene Energy Microservice
 * Real endpoint querying TimescaleDB for actual sensor data
 */
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.ENERGY_PORT ?? SERVICE_PORTS.energy);
const prisma = new PrismaClient({
  datasourceUrl: process.env.TIMESCALE_URL || 
    "postgresql://selene_ts:k0iAjJmuzPH3xD8dh25W5Fod7B9PC73rl2qFUdnqrks=@localhost:5433/selene_measurements"
});

const app = Fastify({ logger: true });

// Health check
app.get("/health", async () => ({
  status: "ok",
  service: "selene-energy",
  version: "1.0.0",
  database: timescaledbStatus(),
}));

async function timescaledbStatus(): Promise<string> {
  try {
    const count = await prisma.sensorReading.count();
    return `connected (${count} readings)`;
  } catch (error) {
    return "disconnected";
  }
}

// Get latest energy reading from all nodes
app.get("/api/energy/latest", async (request, reply) => {
  try {
    // Get most recent reading across all devices
    const latestReadings = await prisma.sensorReading.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
      select: {
        nodeId: true,
        voltage: true,
        current: true,
        power: true,
        pf: true,
        frequency: true,
        apparentPower: true,
        reactivePower: true,
        timestamp: true,
      },
    });

    if (latestReadings.length === 0) {
      return reply.code(200).send({
        message: "No energy readings yet - waiting for device telemetry",
        lastUpdated: null,
        count: 0,
      });
    }

    const mostRecent = latestReadings[0];
    
    return {
      success: true,
      message: `Latest ${latestReadings.length} energy readings from ${new Set(latestReadings.map(r => r.nodeId)).size} devices`,
      lastUpdated: new Date().toISOString(),
      count: latestReadings.length,
      data: latestReadings,
    };
  } catch (error) {
    console.error("Error fetching energy data:", error);
    return reply.code(500).send({
      error: "Database query failed",
      details: error.message,
    });
  }
});

// Get energy data for specific node
app.get("/api/energy/node/:nodeId", async (request, reply) => {
  const { nodeId } = request.params as { nodeId: string };
  
  try {
    const readings = await prisma.sensorReading.findMany({
      where: { nodeId },
      orderBy: { timestamp: "desc" },
      take: 100,
      select: {
        nodeId: true,
        voltage: true,
        current: true,
        power: true,
        pf: true,
        frequency: true,
        apparentPower: true,
        reactivePower: true,
        timestamp: true,
      },
    });

    if (readings.length === 0) {
      return reply.code(404).send({
        error: "No readings found for this node",
        nodeId,
      });
    }

    return {
      success: true,
      nodeId,
      count: readings.length,
      data: readings,
    };
  } catch (error) {
    console.error(`Error fetching data for ${nodeId}:`, error);
    return reply.code(500).send({
      error: "Database query failed",
      nodeId,
      details: error.message,
    });
  }
});

// Get time series data with aggregation
app.get("/api/energy/stats", async (request, reply) => {
  const query = request.query as {
    nodeId?: string;
    hours?: number;
    interval?: "minute" | "hour" | "day";
  };

  const hours = Number(query.hours) || 24;
  const limit = Math.min(hours * 60, 1440); // Max 24h
  
  try {
    const where: any = {};
    if (query.nodeId) {
      where.nodeId = query.nodeId;
    }
    where.timestamp = {
      gte: new Date(Date.now() - hours * 60 * 60 * 1000),
    };

    // Get aggregated stats
    const stats = await prisma.sensorReading.groupBy({
      by: ["nodeId"],
      _avg: {
        voltage: true,
        current: true,
        power: true,
        pf: true,
      },
      _sum: {
        energyKwh: true,
      },
      where,
    });

    return {
      success: true,
      period: `${hours} hours`,
      interval: query.interval || "all",
      devices: stats,
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return reply.code(500).send({
      error: "Statistics query failed",
      details: error.message,
    });
  }
});

// Shutdown handler
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

await app.listen({ port, host: "0.0.0.0" });
console.log(
  `[energy] SELNE energy microservice listening on :${port}`
);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Latest: http://localhost:${port}/api/energy/latest`);
console.log(`  - Node Data: http://localhost:${port}/api/energy/node/:nodeId`);
console.log(`  - Stats: http://localhost:${port}/api/energy/stats`);
console.log(`  - Database: TimescaleDB`);
