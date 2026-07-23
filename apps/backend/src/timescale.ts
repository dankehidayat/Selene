// apps/backend/src/timescale.ts
import { Pool } from "pg";

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

export async function getReadingsInRange(
  from: string,
  to: string,
  bucketSize?: string,
): Promise<any[]> {
  if (!pool) return [];

  let query: string;
  let params: any[] = [from, to];

  if (bucketSize === "hour") {
    query = `
      SELECT 
        time_bucket('1 hour', time) AS bucket,
        AVG(ac_voltage) AS voltage,
        AVG(ac_power) AS power,
        AVG(ac_current) AS current,
        AVG(temperature) AS temperature,
        AVG(humidity) AS humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else if (bucketSize === "day") {
    query = `
      SELECT 
        time_bucket('1 day', time) AS bucket,
        AVG(ac_voltage) AS voltage,
        AVG(ac_power) AS power,
        AVG(ac_current) AS current,
        AVG(temperature) AS temperature,
        AVG(humidity) AS humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else if (bucketSize === "month") {
    query = `
      SELECT 
        time_bucket('1 month', time) AS bucket,
        AVG(ac_voltage) AS voltage,
        AVG(ac_power) AS power,
        AVG(ac_current) AS current,
        AVG(temperature) AS temperature,
        AVG(humidity) AS humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  } else {
    query = `
      SELECT 
        time,
        ac_voltage AS voltage,
        ac_power AS power,
        ac_current AS current,
        temperature,
        humidity
      FROM sensor_readings
      WHERE time >= $1 AND time <= $2
      ORDER BY time ASC
      LIMIT 2000
    `;
  }

  const result = await pool.query(query, params);
  return result.rows.map((row: any) => ({
    timestamp: row.bucket
      ? new Date(row.bucket).toISOString()
      : new Date(row.time).toISOString(),
    voltage: Number(row.voltage?.toFixed(2)) || 0,
    power: Number(row.power?.toFixed(2)) || 0,
    current: Number(row.current?.toFixed(3)) || 0,
    temperature: Number(row.temperature?.toFixed(2)) || 0,
    humidity: Number(row.humidity?.toFixed(2)) || 0,
  }));
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
