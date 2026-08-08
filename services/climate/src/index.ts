/**
 * Selene Climate Microservice
 * Real endpoint querying TimescaleDB for actual sensor data
 */
import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.CLIMATE_PORT ?? SERVICE_PORTS.climate);
const prisma = new PrismaClient({
  datasourceUrl: process.env.TIMESCALE_URL || 
    "postgresql://selene_ts:k0iAjJmuzPH3xD8dh25W5Fod7B9PC73rl2qFUdnqrks=@localhost:5433/selene_measurements"
});

const app = Fastify({ logger: true });

// Health check
app.get("/health", async () => ({
  status: "ok",
  service: "selene-climate",
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

// Get latest climate readings
app.get("/api/climate/latest", async (request, reply) => {
  try {
    const latestReadings = await prisma.sensorReading.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
      select: {
        nodeId: true,
        temperature: true,
        humidity: true,
        pressure: true,
        dewPoint: true,
        timestamp: true,
      },
    });

    if (latestReadings.length === 0) {
      return reply.code(200).send({
        message: "No climate readings yet - waiting for device telemetry",
        lastUpdated: null,
        count: 0,
      });
    }

    const mostRecent = latestReadings[0];
    
    return {
      success: true,
      message: `Latest ${latestReadings.length} climate readings from ${new Set(latestReadings.map(r => r.nodeId)).size} devices`,
      lastUpdated: new Date().toISOString(),
      count: latestReadings.length,
      data: latestReadings,
    };
  } catch (error) {
    console.error("Error fetching climate data:", error);
    return reply.code(500).send({
      error: "Database query failed",
      details: error.message,
    });
  }
});

// Get climate data for specific node
app.get("/api/climate/node/:nodeId", async (request, reply) => {
  const { nodeId } = request.params as { nodeId: string };
  
  try {
    const readings = await prisma.sensorReading.findMany({
      where: { nodeId },
      orderBy: { timestamp: "desc" },
      take: 100,
      select: {
        nodeId: true,
        temperature: true,
        humidity: true,
        pressure: true,
        dewPoint: true,
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

// Get time series stats
app.get("/api/climate/stats", async (request, reply) => {
  const query = request.query as {
    nodeId?: string;
    hours?: number;
  };

  const hours = Number(query.hours) || 24;
  
  try {
    const where: any = {};
    if (query.nodeId) {
      where.nodeId = query.nodeId;
    }
    where.timestamp = {
      gte: new Date(Date.now() - hours * 60 * 60 * 1000),
    };

    const stats = await prisma.sensorReading.groupBy({
      by: ["nodeId"],
      _avg: {
        temperature: true,
        humidity: true,
        pressure: true,
      },
      _min: {
        temperature: true,
        humidity: true,
      },
      _max: {
        temperature: true,
        humidity: true,
      },
      where,
    });

    return {
      success: true,
      period: `${hours} hours`,
      devices: stats,
      metrics: {
        avgTemperature: stats.reduce((sum, s) => sum + (s._avg.temperature ?? 0), 0) / (stats.length || 1),
        avgHumidity: stats.reduce((sum, s) => sum + (s._avg.humidity ?? 0), 0) / (stats.length || 1),
      },
    };
  } catch (error) {
    console.error("Error getting climate stats:", error);
    return reply.code(500).send({
      error: "Statistics query failed",
      details: error.message,
    });
  }
});

// Comfort analysis
app.get("/api/climate/comfort", async (request, reply) => {
  try {
    const latestReadings = await prisma.sensorReading.findMany({
      where: {
        temperature: { not: null },
        humidity: { not: null },
      },
      orderBy: { timestamp: "desc" },
      take: 100,
      select: {
        nodeId: true,
        temperature: true,
        humidity: true,
        timestamp: true,
      },
    });

    if (latestReadings.length === 0) {
      return reply.code(200).send({
        message: "No valid temperature/humidity data available",
      });
    }

    // Analyze comfort levels
    const analysis = latestReadings.map((r) => {
      let comfortLevel = "COMFORTABLE";
      
      if (r.temperature! < 18) comfortLevel = "COLD";
      else if (r.temperature! < 20) comfortLevel = "COOL";
      else if (r.temperature! > 27) comfortLevel = "HOT";
      else if (r.temperature! > 30) comfortLevel = "VERY_HOT";
      
      let humidityLevel = "COMFORTABLE";
      if (r.humidity! < 30) humidityLevel = "DRY";
      else if (r.humidity! > 70) humidityLevel = "HUMID";
      
      return {
        nodeId: r.nodeId,
        temperature: r.temperature!,
        humidity: r.humidity!,
        comfortLevel,
        humidityLevel,
        timestamp: r.timestamp,
      };
    });

    return {
      success: true,
      analysis,
      summary: {
        averageTemp: analysis.reduce((sum, a) => sum + a.temperature, 0) / analysis.length,
        averageHum: analysis.reduce((sum, a) => sum + a.humidity, 0) / analysis.length,
      },
    };
  } catch (error) {
    console.error("Error analyzing comfort:", error);
    return reply.code(500).send({
      error: "Comfort analysis failed",
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
  `[climate] SELNE climate microservice listening on :${port}`
);
console.log(`  - Health: http://localhost:${port}/health`);
console.log(`  - Latest: http://localhost:${port}/api/climate/latest`);
console.log(`  - Node Data: http://localhost:${port}/api/climate/node/:nodeId`);
console.log(`  - Stats: http://localhost:${port}/api/climate/stats`);
console.log(`  - Comfort: http://localhost:${port}/api/climate/comfort`);
console.log(`  - Database: TimescaleDB`);
