import pg, { type Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export function createTimescaleClient(
  connectionString = process.env.TIMESCALE_URL,
  config: PoolConfig = {},
): Pool {
  if (!connectionString) {
    throw new Error("TIMESCALE_URL is not set");
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 10, ...config });
  }
  return pool;
}

export function getTimescalePool(): Pool | null {
  return pool;
}

export async function closeTimescaleClient(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Flat insert into legacy sensor_readings hypertable (energy + climate). */
export async function insertSensorReading(
  db: Pool,
  reading: {
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
    tempComfort?: string | null;
    energyStatus?: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO sensor_readings (
      time, ac_voltage, ac_current, ac_power, cos_phi, apparent_power,
      total_energy, frequency, reactive_power, temperature, humidity,
      temp_comfort, energy_status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
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
      reading.tempComfort ?? null,
      reading.energyStatus ?? null,
    ],
  );
}
