/**
 * Selene Climate Microservice
 * Queries the real `sensor_readings` hypertable (DHT11 climate metrics).
 * Only energy + climate sensors exist; no node_id column in the table.
 */
import Fastify from "fastify";
import { SERVICE_PORTS, createTimescaleClient } from "@selene/shared";
import type { TempComfort } from "@selene/shared";

const port = Number(process.env.CLIMATE_PORT ?? SERVICE_PORTS.climate);
const db = createTimescaleClient();

const app = Fastify({ logger: true });

function toClimateRow(row: Record<string, unknown>) {
  return {
    time: row.time,
    temperature: row.temperature,
    humidity: row.humidity,
    temp_comfort: row.temp_comfort,
  };
}

function comfortFor(t: number | null, h: number | null): {
  comfort: TempComfort;
  humidityClass: string;
} {
  let comfort: TempComfort = "COMFORTABLE";
  if (t != null) {
    if (t < 18) comfort = "COLD";
    else if (t < 20) comfort = "COOL";
    else if (t < 27) comfort = "COMFORTABLE";
    else if (t < 30) comfort = "WARM";
    else comfort = "HOT";
  }
  let humidityClass = "COMFORTABLE";
  if (h != null) {
    if (h < 30) humidityClass = "DRY";
    else if (h > 70) humidityClass = "HUMID";
  }
  return { comfort, humidityClass };
}

app.get("/health", async () => {
  let database = "disconnected";
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS count FROM sensor_readings`,
    );
    database = `connected (${res.rows[0].count} readings)`;
  } catch (error) {
    database = `disconnected: ${(error as Error).message}`;
  }
  return { status: "ok", service: "selene-climate", database };
});

app.get("/api/climate/latest", async (request, reply) => {
  try {
    const res = await db.query(
      `SELECT * FROM sensor_readings ORDER BY time DESC LIMIT 50`,
    );
    const rows = res.rows.map(toClimateRow);
    if (rows.length === 0) {
      return {
        message: "No climate readings yet - waiting for device telemetry",
        lastUpdated: null,
        count: 0,
      };
    }
    return {
      success: true,
      message: `Latest ${rows.length} climate readings`,
      lastUpdated: new Date().toISOString(),
      count: rows.length,
      data: rows,
    };
  } catch (error) {
    console.error("Error fetching climate data:", error);
    return reply.code(500).send({
      error: "Database query failed",
      details: (error as Error).message,
    });
  }
});

app.get("/api/climate/node/:nodeId", async (request, reply) => {
  const { nodeId } = request.params as { nodeId: string };
  return reply.code(404).send({
    error: "sensor_readings table has no node affinity",
    nodeId,
  });
});

app.get("/api/climate/stats", async (request, reply) => {
  const query = request.query as { hours?: number };
  const hours = Number(query.hours) || 24;

  try {
    const res = await db.query(
      `SELECT
         AVG(temperature) AS avg_temperature,
         AVG(humidity)    AS avg_humidity,
         MIN(temperature) AS min_temperature,
         MAX(temperature) AS max_temperature,
         MIN(humidity)    AS min_humidity,
         MAX(humidity)    AS max_humidity,
         COUNT(*)::int    AS n
       FROM sensor_readings
       WHERE time >= NOW() - ($1::int * INTERVAL '1 hour')`,
      [hours],
    );
    const s = res.rows[0];
    return {
      success: true,
      period: `${hours} hours`,
      byNode: [{ node: "office-main", ...s }],
      metrics: {
        avgTemperature: s.avg_temperature,
        avgHumidity: s.avg_humidity,
      },
    };
  } catch (error) {
    console.error("Error getting climate stats:", error);
    return reply.code(500).send({
      error: "Statistics query failed",
      details: (error as Error).message,
    });
  }
});

app.get("/api/climate/comfort", async (request, reply) => {
  try {
    const res = await db.query(
      `SELECT temperature, humidity, temp_comfort, time
         FROM sensor_readings
        WHERE temperature IS NOT NULL OR humidity IS NOT NULL
        ORDER BY time DESC LIMIT 100`,
    );
    const rows = res.rows;
    if (rows.length === 0) {
      return { message: "No valid temperature/humidity data available" };
    }

    const analysis = rows.map((r) => {
      const { comfort, humidityClass } = comfortFor(
        r.temperature,
        r.humidity,
      );
      return {
        temperature: r.temperature,
        humidity: r.humidity,
        comfort,
        humidityClass,
        timestamp: r.time,
      };
    });

    const temps = analysis
      .map((a) => a.temperature)
      .filter((t): t is number => t != null);
    const hums = analysis
      .map((a) => a.humidity)
      .filter((h): h is number => h != null);

    return {
      success: true,
      analysis,
      summary: {
        averageTemp: temps.length
          ? temps.reduce((a, b) => a + b, 0) / temps.length
          : null,
        averageHum: hums.length
          ? hums.reduce((a, b) => a + b, 0) / hums.length
          : null,
      },
    };
  } catch (error) {
    console.error("Error analyzing comfort:", error);
    return reply.code(500).send({
      error: "Comfort analysis failed",
      details: (error as Error).message,
    });
  }
});

process.on("SIGINT", async () => {
  await db.end();
  process.exit(0);
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[climate] sensor readings microservice listening on :${port}`);