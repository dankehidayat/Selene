import { Pool } from "pg";
import { createTimescaleClient } from "@selene/shared";

/** PLN R-1/TR 1,300–2,200 VA official flat rate (Rp/kWh). Used for estimates. */
export const PLN_RP_PER_KWH = 1444.7;

export function formatEstimatedCost(totalKwh: number): string {
  return `Rp ${Math.round(totalKwh * PLN_RP_PER_KWH).toLocaleString("id-ID")}`;
}

const CAGG_1H = "sensor_readings_1h";
const CAGG_5M = "sensor_readings_5m";

let pool: Pool | null = null;
let caggReady = false;
let initPromise: Promise<void> | null = null;

export async function initTimescaleDB(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = initInternal().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function initInternal(): Promise<void> {
  if (!process.env.TIMESCALE_URL) {
    console.warn("[analytics] TIMESCALE_URL not set — TimescaleDB disabled");
    return;
  }
  pool = createTimescaleClient(process.env.TIMESCALE_URL);
  try {
    await pool.query(`SELECT 1`);
    // Probe for the continuous-aggregate views (created by the monolith).
    const views = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_name IN ('sensor_readings_1h', 'sensor_readings_5m')`,
    );
    caggReady = Number(views.rows[0]?.n) === 2;
  } catch (error) {
    console.warn("[analytics] DB probe failed:", (error as Error).message);
  }
}

export async function closeTimescaleDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Liveness DB check for /health. */
export async function pingDatabase(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query(`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

async function caggHasRows(view: string, from: string, to: string): Promise<boolean> {
  if (!pool || !caggReady) return false;
  try {
    const r = await pool.query(
      `SELECT 1 FROM ${view} WHERE bucket >= $1 AND bucket <= $2 LIMIT 1`,
      [from, to],
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/** Systematic sample — preserves time order. */
function systematicSample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  const step = items.length / max;
  for (let i = 0; i < max; i++) {
    out.push(items[Math.min(items.length - 1, Math.floor(i * step))]);
  }
  return out;
}

function mapCaggToAnalytics(row: any) {
  return {
    timestamp: new Date(row.bucket).toISOString(),
    acVoltage: Number(row.avg_voltage) || 0,
    acCurrent: Number(row.avg_current) || 0,
    acPower: Number(row.avg_power) || 0,
    cosPhi: Number(row.avg_cos_phi) || 0,
    apparentPower: Number(row.avg_apparent) || 0,
    totalEnergy: 0,
    frequency: 0,
    reactivePower: Number(row.avg_reactive) || 0,
    temperature: Number(row.avg_temperature) || 0,
    humidity: Number(row.avg_humidity) || 0,
    tempComfort: row.temp_comfort ?? "COMFORTABLE",
    energyStatus: row.energy_status ?? "NORMAL",
    n: Number(row.n) || 1,
    minPower: Number(row.min_power) || 0,
    maxPower: Number(row.max_power) || 0,
  };
}

export async function getAllReadingsForAnalytics(
  from: string,
  to: string,
  rangeOrBucket?: string,
): Promise<any[]> {
  if (!pool) return [];

  const longRange = ["24h", "7d", "30d", "3m", "6m", "1y", "day", "month"].includes(
    rangeOrBucket ?? "",
  );
  const prefer1h = ["30d", "3m", "6m", "1y", "month"].includes(rangeOrBucket ?? "");
  const maxClassify = prefer1h ? 9000 : longRange ? 6000 : 3000;

  if (longRange) {
    const view = prefer1h ? CAGG_1H : CAGG_5M;
    if (await caggHasRows(view, from, to)) {
      const result = await pool.query(
        `SELECT * FROM ${view}
         WHERE bucket >= $1 AND bucket <= $2
         ORDER BY bucket ASC`,
        [from, to],
      );
      let points = result.rows.map(mapCaggToAnalytics);
      if (points.length > maxClassify) {
        points = systematicSample(points, maxClassify);
      }
      return points;
    }
  }

  if (rangeOrBucket === "1h" || !longRange) {
    const result = await pool.query(
      `SELECT * FROM sensor_readings
       WHERE time >= $1 AND time <= $2
       ORDER BY time ASC
       LIMIT $3`,
      [from, to, maxClassify],
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
      n: 1,
    }));
  }

  const interval = prefer1h ? "1 hour" : "5 minutes";
  const result = await pool.query(
    `SELECT
      time_bucket($3::interval, time) AS bucket,
      AVG(ac_voltage) AS avg_voltage,
      AVG(ac_current) AS avg_current,
      AVG(ac_power) AS avg_power,
      AVG(cos_phi) AS avg_cos_phi,
      AVG(reactive_power) AS avg_reactive,
      AVG(apparent_power) AS avg_apparent,
      AVG(temperature) AS avg_temperature,
      AVG(humidity) AS avg_humidity,
      MIN(ac_power) AS min_power,
      MAX(ac_power) AS max_power,
      last(temp_comfort, time) AS temp_comfort,
      last(energy_status, time) AS energy_status,
      COUNT(*)::int AS n
    FROM sensor_readings
    WHERE time >= $1 AND time <= $2
    GROUP BY bucket
    ORDER BY bucket ASC`,
    [from, to, interval],
  );
  let points = result.rows.map(mapCaggToAnalytics);
  if (points.length > maxClassify) {
    points = systematicSample(points, maxClassify);
  }
  return points;
}

/** Energy (kWh) over [from, to] from the PZEM cumulative counter. */
export async function getCumulativeEnergyKwh(
  from: string,
  to: string,
): Promise<number | null> {
  if (!pool) return null;
  const result = await pool.query(
    `WITH ordered AS (
       SELECT time, total_energy AS e
       FROM sensor_readings
       WHERE time >= $1 AND time <= $2
         AND total_energy IS NOT NULL
     ),
     deltas AS (
       SELECT e, LAG(e) OVER (ORDER BY time ASC) AS prev FROM ordered
     )
     SELECT COUNT(*)::bigint AS n,
       COALESCE(SUM(
         CASE WHEN prev IS NULL THEN 0
              WHEN e + 1e-9 >= prev THEN e - prev
              ELSE e END
       ), 0) AS energy_kwh,
       COALESCE(MAX(e), 0) AS max_e
     FROM deltas`,
    [from, to],
  );
  const row = result.rows[0];
  if (!row || !row.n || Number(row.n) < 2) return null;
  const kwh = Number(row.energy_kwh);
  const maxE = Number(row.max_e);
  if (!Number.isFinite(kwh)) return null;
  if (maxE <= 0 && kwh <= 0) return null;
  return Math.max(0, kwh);
}

async function getIntegratedEnergyKwhFromCagg(
  view: string,
  from: string,
  to: string,
  bucket: "1h" | "5m",
): Promise<number> {
  if (!pool) return 0;
  const expectedN = bucket === "1h" ? 720 : 60;
  const bucketHours = bucket === "1h" ? 1.0 : 5.0 / 60.0;
  const result = await pool.query(
    `SELECT COALESCE(SUM(
       avg_power * LEAST(1.0, n::float / $3) * $4
     ), 0) AS energy_wh
     FROM ${view}
     WHERE bucket >= $1 AND bucket <= $2`,
    [from, to, expectedN, bucketHours],
  );
  const wh = Math.max(0, Number(result.rows[0]?.energy_wh) || 0);
  return wh / 1000;
}

export async function getEnergySummaryFromCagg(
  from: string,
  to: string,
  range: string,
): Promise<null | {
  dataPoints: number;
  timeSpan: { from: string; to: string };
  power: { average: number; median: number; stdDeviation: number; min: number; max: number };
  voltage: { average: number };
  powerFactor: { average: number };
  reactivePower: { average: number; ratio: number };
  energy: { totalKwh: number; estimatedCost: string };
  peakHours: Array<{ hour: number; avgPower: number }>;
}> {
  if (!pool) return null;

  const prefer1h = ["30d", "3m", "6m", "1y"].includes(range);
  const view = prefer1h || range !== "1h" ? (prefer1h ? CAGG_1H : CAGG_5M) : null;
  if (!view || !(await caggHasRows(view, from, to))) return null;

  const bucketKind: "1h" | "5m" = prefer1h ? "1h" : "5m";
  const stats = await pool.query(
    `SELECT
      SUM(n)::bigint AS data_points,
      MIN(bucket) AS t_from,
      MAX(bucket) AS t_to,
      SUM(avg_power * n) / NULLIF(SUM(n), 0) AS avg_power,
      SUM(avg_voltage * n) / NULLIF(SUM(n), 0) AS avg_voltage,
      SUM(avg_cos_phi * n) / NULLIF(SUM(n), 0) AS avg_pf,
      SUM(avg_reactive * n) / NULLIF(SUM(n), 0) AS avg_reactive,
      MIN(min_power) AS min_power,
      MAX(max_power) AS max_power
    FROM ${view}
    WHERE bucket >= $1 AND bucket <= $2`,
    [from, to],
  );
  const s = stats.rows[0];
  if (!s || !s.data_points) return null;

  const cumulativeKwh = await getCumulativeEnergyKwh(from, to);
  const totalKwh =
    cumulativeKwh != null
      ? cumulativeKwh
      : await getIntegratedEnergyKwhFromCagg(view, from, to, bucketKind);

  const series = await pool.query(
    `SELECT avg_power FROM ${view}
     WHERE bucket >= $1 AND bucket <= $2
     ORDER BY avg_power ASC`,
    [from, to],
  );
  const powers = series.rows.map((r: any) => Number(r.avg_power) || 0);
  const mid = Math.floor(powers.length / 2);
  const median =
    powers.length === 0
      ? 0
      : powers.length % 2
        ? powers[mid]
        : (powers[mid - 1] + powers[mid]) / 2;
  const avg = Number(s.avg_power) || 0;
  const variance =
    powers.length > 0
      ? powers.reduce((a: number, p: number) => a + (p - avg) ** 2, 0) / powers.length
      : 0;

  const peak = await pool.query(
    `SELECT EXTRACT(HOUR FROM bucket)::int AS hour, AVG(avg_power) AS avg_power
     FROM ${view}
     WHERE bucket >= $1 AND bucket <= $2
     GROUP BY 1 ORDER BY 1`,
    [from, to],
  );
  const peakMap = new Map<number, number>(
    peak.rows.map((r: any) => [Number(r.hour), Number(r.avg_power) || 0]),
  );
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgPower: +(peakMap.get(hour) ?? 0).toFixed(2),
  }));

  const avgReactive = Number(s.avg_reactive) || 0;
  return {
    dataPoints: Number(s.data_points) || powers.length,
    timeSpan: {
      from: new Date(s.t_from).toISOString(),
      to: new Date(s.t_to).toISOString(),
    },
    power: {
      average: +Number(s.avg_power || 0).toFixed(2),
      median: +median.toFixed(2),
      stdDeviation: +Math.sqrt(variance).toFixed(2),
      min: +(Number(s.min_power) || 0).toFixed(2),
      max: +(Number(s.max_power) || 0).toFixed(2),
    },
    voltage: { average: +(Number(s.avg_voltage) || 0).toFixed(2) },
    powerFactor: { average: +(Number(s.avg_pf) || 0).toFixed(2) },
    reactivePower: {
      average: +avgReactive.toFixed(2),
      ratio: +(avgReactive / (Number(s.avg_power) || 1)).toFixed(3),
    },
    energy: {
      totalKwh: +totalKwh.toFixed(3),
      estimatedCost: formatEstimatedCost(totalKwh),
    },
    peakHours,
  };
}

export async function getExportData(): Promise<any[]> {
  if (!pool) return [];
  const result = await pool.query(`SELECT * FROM sensor_readings ORDER BY time ASC`);
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

export function getRangeConfig(range: string): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const hours: Record<string, number> = {
    "1h": 1,
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
    "3m": 24 * 90,
    "6m": 24 * 180,
    "1y": 24 * 365,
  };
  const h = hours[range] ?? 24 * 7;
  return { from: new Date(now.getTime() - h * 60 * 60 * 1000), to: now };
}

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2
    ? arr[mid]
    : (arr[mid - 1] + arr[mid]) / 2;
}

export function stdDev(arr: number[], avg: number): number {
  if (!arr.length) return 0;
  return Math.sqrt(
    arr.reduce((a, v) => a + (v - avg) ** 2, 0) / arr.length,
  );
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

type EnergyRow = { acPower: number };
type ClimateRow = { temperature: number; humidity: number };