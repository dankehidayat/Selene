/**
 * Selene Energy Microservice
 * Queries the real `sensor_readings` hypertable (PZEM-004T energy metrics).
 * Only energy + climate sensors exist; no node_id column in the table.
 */
import Fastify from "fastify";
import { SERVICE_PORTS, createTimescaleClient } from "@selene/shared";

const port = Number(process.env.ENERGY_PORT ?? SERVICE_PORTS.energy);
const db = createTimescaleClient();

const app = Fastify({ logger: true });

function toEnergyRow(row: Record<string, unknown>) {
  return {
    time: row.time,
    voltage: row.ac_voltage,
    current: row.ac_current,
    power: row.ac_power,
    pf: row.cos_phi,
    apparent_power: row.apparent_power,
    reactive_power: row.reactive_power,
    total_energy: row.total_energy,
    frequency: row.frequency,
    temp_comfort: row.temp_comfort,
    energy_status: row.energy_status,
  };
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
  return { status: "ok", service: "selene-energy", database };
});

app.get("/api/energy/latest", async (request, reply) => {
  try {
    const res = await db.query(
      `SELECT * FROM sensor_readings ORDER BY time DESC LIMIT 50`,
    );
    const rows = res.rows.map(toEnergyRow);
    if (rows.length === 0) {
      return {
        message: "No energy readings yet - waiting for device telemetry",
        lastUpdated: null,
        count: 0,
      };
    }
    return {
      success: true,
      message: `Latest ${rows.length} energy readings`,
      lastUpdated: new Date().toISOString(),
      count: rows.length,
      data: rows,
    };
  } catch (error) {
    console.error("Error fetching energy data:", error);
    return reply.code(500).send({
      error: "Database query failed",
      details: (error as Error).message,
    });
  }
});

app.get("/api/energy/node/:nodeId", async (request, reply) => {
  const { nodeId } = request.params as { nodeId: string };
  return reply.code(404).send({
    error: "sensor_readings table has no node affinity",
    nodeId,
  });
});

app.get("/api/energy/stats", async (request, reply) => {
  const query = request.query as { hours?: number };
  const hours = Number(query.hours) || 24;

  try {
    const res = await db.query(
      `SELECT
         AVG(ac_voltage)      AS avg_voltage,
         AVG(ac_current)      AS avg_current,
         AVG(ac_power)        AS avg_power,
         AVG(cos_phi)         AS avg_pf,
         AVG(apparent_power)  AS avg_apparent,
         AVG(reactive_power)  AS avg_reactive,
         SUM(total_energy)    AS total_energy,
         MIN(ac_power)        AS min_power,
         MAX(ac_power)        AS max_power,
         COUNT(*)::int        AS n
       FROM sensor_readings
       WHERE time >= NOW() - ($1::int * INTERVAL '1 hour')`,
      [hours],
    );
    const s = res.rows[0];
    return {
      success: true,
      period: `${hours} hours`,
      byNode: [{ node: "office-main", ...s }],
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return reply.code(500).send({
      error: "Statistics query failed",
      details: (error as Error).message,
    });
  }
});

process.on("SIGINT", async () => {
  await db.end();
  process.exit(0);
});

await app.listen({ port, host: "0.0.0.0" });
console.log(`[energy] sensor readings microservice listening on :${port}`);