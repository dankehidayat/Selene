// apps/backend/src/timescale.ts
import { Pool } from "pg";
import { emaSmooth, lttb } from "./lib/lttb";

const TIMESCALE_URL = process.env.TIMESCALE_URL;

if (!TIMESCALE_URL) {
  console.warn("TIMESCALE_URL not set — TimescaleDB features disabled");
}

const pool = TIMESCALE_URL
  ? new Pool({ connectionString: TIMESCALE_URL, max: 10 })
  : null;

export async function initTimescaleDB(): Promise<void> {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        time        TIMESTAMPTZ NOT NULL,
        ac_voltage  DOUBLE PRECISION,
        ac_current  DOUBLE PRECISION,
        ac_power    DOUBLE PRECISION,
        cos_phi     DOUBLE PRECISION,
        apparent_power DOUBLE PRECISION,
        total_energy   DOUBLE PRECISION,
        frequency   DOUBLE PRECISION,
        reactive_power DOUBLE PRECISION,
        temperature DOUBLE PRECISION,
        humidity    DOUBLE PRECISION,
        temp_comfort TEXT,
        energy_status TEXT,
        current_per_kw DOUBLE PRECISION,
        power_quality_score DOUBLE PRECISION,
        energy_cost TEXT,
        voltage_stability DOUBLE PRECISION
      );
    `);

    await client.query(`
      SELECT create_hypertable('sensor_readings', 'time', 
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => TRUE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_readings_time_desc 
      ON sensor_readings (time DESC);
    `);

    console.log("TimescaleDB initialized successfully");
  } catch (error) {
    console.error("TimescaleDB initialization failed:", error);
  } finally {
    client.release();
  }
}

export async function insertReading(reading: {
  time: string;
  acVoltage: number;
  acCurrent: number;
  acPower: number;
  cosPhi: number;
  apparentPower: number;
  totalEnergy: number;
  frequency: number;
  reactivePower: number;
  temperature: number;
  humidity: number;
  tempComfort: string;
  energyStatus: string;
  currentPerKW?: number;
  powerQualityScore?: number;
  energyCost?: string;
  voltageStability?: number;
}): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO sensor_readings (
        time, ac_voltage, ac_current, ac_power, cos_phi, apparent_power,
        total_energy, frequency, reactive_power, temperature, humidity,
        temp_comfort, energy_status, current_per_kw, power_quality_score,
        energy_cost, voltage_stability
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) ON CONFLICT DO NOTHING`,
      [
        reading.time,
        reading.acVoltage,
        reading.acCurrent,
        reading.acPower,
        reading.cosPhi,
        reading.apparentPower,
        reading.totalEnergy,
        reading.frequency,
        reading.reactivePower,
        reading.temperature,
        reading.humidity,
        reading.tempComfort,
        reading.energyStatus,
        reading.currentPerKW ?? null,
        reading.powerQualityScore ?? null,
        reading.energyCost ?? null,
        reading.voltageStability ?? null,
      ],
    );
  } catch (error) {
    console.error("Failed to insert reading:", error);
  }
}

export async function getLatestReading(): Promise<any> {
  if (!pool) return null;

  const result = await pool.query(
    `SELECT * FROM sensor_readings ORDER BY time DESC LIMIT 1`,
  );
  return result.rows[0] || null;
}

/**
 * Range → fine sampling plan.
 * Prefer last() samples (actual readings) over AVG, then LTTB for shape,
 * then light EMA so charts stay precise without looking noisy.
 */
function getHistorySamplePlan(rangeOrBucket?: string): {
  interval: string | null;
  maxPoints: number;
  smoothAlpha: number;
  rawLimit: number;
} {
  // Legacy coarse buckets still supported
  if (rangeOrBucket === "hour")
    return {
      interval: "15 minutes",
      maxPoints: 400,
      smoothAlpha: 0.2,
      rawLimit: 10000,
    };
  if (rangeOrBucket === "day")
    return {
      interval: "1 hour",
      maxPoints: 360,
      smoothAlpha: 0.25,
      rawLimit: 12000,
    };
  if (rangeOrBucket === "month")
    return {
      interval: "6 hours",
      maxPoints: 300,
      smoothAlpha: 0.28,
      rawLimit: 12000,
    };

  switch (rangeOrBucket) {
    case "1h":
      return {
        interval: null,
        maxPoints: 480,
        smoothAlpha: 0.12,
        rawLimit: 3600,
      };
    case "24h":
      return {
        interval: "2 minutes",
        maxPoints: 420,
        smoothAlpha: 0.18,
        rawLimit: 8000,
      };
    case "7d":
      return {
        interval: "15 minutes",
        maxPoints: 400,
        smoothAlpha: 0.22,
        rawLimit: 10000,
      };
    case "30d":
      return {
        interval: "1 hour",
        maxPoints: 360,
        smoothAlpha: 0.25,
        rawLimit: 12000,
      };
    case "3m":
      return {
        interval: "4 hours",
        maxPoints: 320,
        smoothAlpha: 0.28,
        rawLimit: 12000,
      };
    case "6m":
      return {
        interval: "8 hours",
        maxPoints: 300,
        smoothAlpha: 0.3,
        rawLimit: 12000,
      };
    case "1y":
      return {
        interval: "1 day",
        maxPoints: 366,
        smoothAlpha: 0.3,
        rawLimit: 12000,
      };
    default:
      return {
        interval: "15 minutes",
        maxPoints: 400,
        smoothAlpha: 0.22,
        rawLimit: 10000,
      };
  }
}

export async function getReadingsInRange(
  from: string,
  to: string,
  /** UI range ("24h") or legacy bucket ("hour"|"day"|"month") */
  rangeOrBucket?: string,
): Promise<any[]> {
  if (!pool) return [];

  const plan = getHistorySamplePlan(rangeOrBucket);
  let rows: any[];

  if (!plan.interval) {
    const result = await pool.query(
      `SELECT
        time,
        ac_voltage AS voltage,
        ac_power AS power,
        ac_current AS current,
        temperature,
        humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      ORDER BY time ASC
      LIMIT $3`,
      [from, to, plan.rawLimit],
    );
    rows = result.rows;
  } else {
    // last(value, time) keeps a real measured sample per bucket (not an average)
    const result = await pool.query(
      `SELECT
        time_bucket($3::interval, time) AS bucket,
        last(ac_voltage, time) AS voltage,
        last(ac_power, time) AS power,
        last(ac_current, time) AS current,
        last(temperature, time) AS temperature,
        last(humidity, time) AS humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      GROUP BY bucket
      ORDER BY bucket ASC`,
      [from, to, plan.interval],
    );
    rows = result.rows;
  }

  let points = rows.map((row: any) => ({
    timestamp: row.bucket
      ? new Date(row.bucket).toISOString()
      : new Date(row.time).toISOString(),
    voltage: Number(Number(row.voltage).toFixed(3)) || 0,
    power: Number(Number(row.power).toFixed(3)) || 0,
    current: Number(Number(row.current).toFixed(4)) || 0,
    temperature: Number(Number(row.temperature).toFixed(3)) || 0,
    humidity: Number(Number(row.humidity).toFixed(3)) || 0,
  }));

  // Shape-preserving downsample (keeps peaks/valleys; not min/max collapse)
  if (points.length > plan.maxPoints) {
    points = lttb(
      points,
      plan.maxPoints,
      (p) => new Date(p.timestamp).getTime(),
      (p) => p.power,
    );
  }

  // Light EMA — softens sensor noise without flattening the series
  if (points.length > 3 && plan.smoothAlpha > 0) {
    const keys = [
      "voltage",
      "power",
      "current",
      "temperature",
      "humidity",
    ] as const;
    for (const key of keys) {
      const smoothed = emaSmooth(
        points.map((p) => p[key]),
        plan.smoothAlpha,
      );
      points = points.map((p, i) => ({
        ...p,
        [key]:
          key === "current"
            ? Number(smoothed[i].toFixed(4))
            : Number(smoothed[i].toFixed(3)),
      }));
    }
  }

  return points;
}

export async function getRecentLogs(limit: number = 20): Promise<any[]> {
  if (!pool) return [];

  const result = await pool.query(
    `SELECT * FROM sensor_readings ORDER BY time DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: any) => ({
    timestamp: new Date(row.time).toISOString(),
    acVoltage: row.ac_voltage,
    acCurrent: row.ac_current,
    acPower: row.ac_power,
    cosPhi: row.cos_phi,
    apparentPower: row.apparent_power,
    totalEnergy: row.total_energy,
    frequency: row.frequency,
    reactivePower: row.reactive_power,
    temperature: row.temperature,
    humidity: row.humidity,
    tempComfort: row.temp_comfort,
    energyStatus: row.energy_status,
    powerQualityScore: row.power_quality_score,
    voltageStability: row.voltage_stability,
  }));
}

export async function getAllReadingsForAnalytics(
  from: string,
  to: string,
): Promise<any[]> {
  if (!pool) return [];

  const result = await pool.query(
    `SELECT * FROM sensor_readings WHERE time >= $1 AND time <= $2 ORDER BY time ASC`,
    [from, to],
  );
  return result.rows.map((row: any) => ({
    timestamp: new Date(row.time).toISOString(),
    acVoltage: row.ac_voltage,
    acCurrent: row.ac_current,
    acPower: row.ac_power,
    cosPhi: row.cos_phi,
    apparentPower: row.apparent_power,
    totalEnergy: row.total_energy,
    frequency: row.frequency,
    reactivePower: row.reactive_power,
    temperature: row.temperature,
    humidity: row.humidity,
    tempComfort: row.temp_comfort,
    energyStatus: row.energy_status,
    currentPerKW: row.current_per_kw,
    powerQualityScore: row.power_quality_score,
    energyCost: row.energy_cost,
    voltageStability: row.voltage_stability,
  }));
}

export async function getExportData(): Promise<any[]> {
  if (!pool) return [];

  const result = await pool.query(
    `SELECT * FROM sensor_readings ORDER BY time ASC`,
  );
  return result.rows.map((row: any) => ({
    timestamp: new Date(row.time).toISOString(),
    acVoltage: row.ac_voltage,
    acCurrent: row.ac_current,
    acPower: row.ac_power,
    cosPhi: row.cos_phi,
    apparentPower: row.apparent_power,
    totalEnergy: row.total_energy,
    frequency: row.frequency,
    reactivePower: row.reactive_power,
    temperature: row.temperature,
    humidity: row.humidity,
    tempComfort: row.temp_comfort,
    energyStatus: row.energy_status,
  }));
}

export async function getEnergyInRange(
  from: string,
  to: string,
  bucketSize?: string,
): Promise<{ timestamp: string; energy_kwh: number }[]> {
  if (!pool) return [];

  const result = await pool.query(
    `SELECT time, ac_power FROM sensor_readings 
     WHERE time >= $1 AND time <= $2 
     ORDER BY time ASC`,
    [from, to],
  );

  const rows = result.rows;
  if (rows.length < 2) return [];

  const buckets = new Map<string, { energy_wh: number; timestamp: string }>();

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const intervalHours =
      (new Date(curr.time).getTime() - new Date(prev.time).getTime()) / 3600000;
    const energyWh = ((prev.ac_power + curr.ac_power) / 2) * intervalHours;

    let key: string;
    if (bucketSize === "hour") key = curr.time.toISOString().slice(0, 13);
    else if (bucketSize === "day") key = curr.time.toISOString().slice(0, 10);
    else if (bucketSize === "month") key = curr.time.toISOString().slice(0, 7);
    else key = curr.time.toISOString().slice(0, 13);

    const existing = buckets.get(key);
    if (existing) {
      existing.energy_wh += energyWh;
    } else {
      let bucketTimestamp: string;
      if (bucketSize === "hour") bucketTimestamp = `${key}:00:00.000Z`;
      else if (bucketSize === "day") bucketTimestamp = `${key}T12:00:00.000Z`;
      else if (bucketSize === "month")
        bucketTimestamp = `${key}-01T12:00:00.000Z`;
      else bucketTimestamp = `${key}:00:00.000Z`;
      buckets.set(key, { energy_wh: energyWh, timestamp: bucketTimestamp });
    }
  }

  return Array.from(buckets.values())
    .map((b) => ({
      timestamp: b.timestamp,
      energy_kwh: +b.energy_wh.toFixed(1),
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
}

export async function getTimescaleStats(): Promise<any> {
  if (!pool) return null;

  const result = await pool.query(`
    SELECT 
      COUNT(*) AS total_rows,
      MIN(time) AS first_reading,
      MAX(time) AS last_reading,
      pg_size_pretty(hypertable_size('sensor_readings')) AS table_size
    FROM sensor_readings
  `);
  return result.rows[0] || null;
}

export async function closeTimescaleDB(): Promise<void> {
  if (pool) await pool.end();
}
