// apps/backend/src/timescale.ts
import { Pool } from "pg";
import { emaSmooth, lttb } from "./lib/lttb";

/**
 * PLN R-1/TR 1,300–2,200 VA official flat rate (Rp/kWh).
 * Triwulan III 2026 (Juli–September): unchanged vs prior quarter (ESDM/PLN).
 * Use the same figure for R-1 1300 VA and 2200 VA non-subsidized residential.
 */
export const PLN_RP_PER_KWH = 1444.7;

/** Format estimated cost from kWh using the official PLN residential rate. */
export function formatEstimatedCost(totalKwh: number): string {
  return `Rp ${Math.round(totalKwh * PLN_RP_PER_KWH).toLocaleString("id-ID")}`;
}

const TIMESCALE_URL = process.env.TIMESCALE_URL;

if (!TIMESCALE_URL) {
  console.warn("TIMESCALE_URL not set — TimescaleDB features disabled");
}

const pool = TIMESCALE_URL
  ? new Pool({ connectionString: TIMESCALE_URL, max: 10 })
  : null;

/** Continuous aggregate names (materialized hourly / 5-minute rollups). */
export const CAGG_1H = "sensor_readings_1h";
export const CAGG_5M = "sensor_readings_5m";

let caggReady = false;

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

    await ensureContinuousAggregates(client);
    console.log("TimescaleDB initialized successfully");
  } catch (error) {
    console.error("TimescaleDB initialization failed:", error);
  } finally {
    client.release();
  }
}

async function ensureContinuousAggregates(client: {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}): Promise<void> {
  const create5m = `
    CREATE MATERIALIZED VIEW ${CAGG_5M}
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('5 minutes', time) AS bucket,
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
    GROUP BY bucket
    WITH NO DATA;
  `;
  const create1h = `
    CREATE MATERIALIZED VIEW ${CAGG_1H}
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 hour', time) AS bucket,
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
    GROUP BY bucket
    WITH NO DATA;
  `;

  // Create if missing (already-exists is fine on restart)
  for (const [name, sql] of [
    [CAGG_5M, create5m],
    [CAGG_1H, create1h],
  ] as const) {
    try {
      await client.query(sql);
      console.log(`Created continuous aggregate ${name}`);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!/already exists/i.test(msg)) {
        console.warn(`CAGG ${name}:`, msg);
      }
    }
  }

  // Refresh policies (ignore if already exist)
  try {
    await client.query(`
      SELECT add_continuous_aggregate_policy('${CAGG_5M}',
        start_offset => INTERVAL '2 days',
        end_offset   => INTERVAL '5 minutes',
        schedule_interval => INTERVAL '5 minutes',
        if_not_exists => TRUE);
    `);
  } catch (e) {
    console.warn("5m CAGG policy:", (e as Error).message);
  }
  try {
    await client.query(`
      SELECT add_continuous_aggregate_policy('${CAGG_1H}',
        start_offset => INTERVAL '30 days',
        end_offset   => INTERVAL '1 hour',
        schedule_interval => INTERVAL '15 minutes',
        if_not_exists => TRUE);
    `);
  } catch (e) {
    console.warn("1h CAGG policy:", (e as Error).message);
  }

  // Backfill so existing data is usable immediately
  try {
    await client.query(
      `CALL refresh_continuous_aggregate('${CAGG_5M}', NULL, NULL);`,
    );
    await client.query(
      `CALL refresh_continuous_aggregate('${CAGG_1H}', NULL, NULL);`,
    );
    caggReady = true;
    console.log("Continuous aggregates refreshed (5m + 1h)");
  } catch (e) {
    console.warn("CAGG refresh:", (e as Error).message);
    // Views may still exist and fill on schedule
    caggReady = true;
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

/** Clamp client-requested chart budget (~2× CSS pixels). */
export function clampMaxPoints(requested?: number, fallback = 400): number {
  if (requested == null || !Number.isFinite(requested)) return fallback;
  return Math.max(48, Math.min(1000, Math.floor(requested)));
}

/**
 * Which store to read for a UI range.
 * Short: raw. Medium: 5m CAGG. Long: 1h CAGG.
 *
 * When `spanHours` is provided (custom From/To), resolve by span:
 *  ≤ 2h → raw,  ≤ 192h (8d) → 5m,  else → 1h.
 */
function chartSourceForRange(rangeOrBucket?: string, spanHours?: number): {
  source: "raw" | "5m" | "1h";
  interval: string | null;
  defaultMax: number;
  smoothAlpha: number;
  rawLimit: number;
} {
  // Span-based resolution for custom From/To ranges
  if (spanHours != null) {
    if (spanHours <= 2)
      return { source: "raw", interval: null, defaultMax: 480, smoothAlpha: 0.12, rawLimit: 3600 };
    if (spanHours <= 192)
      return { source: "5m", interval: "5 minutes", defaultMax: 400, smoothAlpha: 0.22, rawLimit: 4000 };
    return { source: "1h", interval: "1 hour", defaultMax: 360, smoothAlpha: 0.25, rawLimit: 4000 };
  }

  if (rangeOrBucket === "hour")
    return {
      source: "5m",
      interval: "5 minutes",
      defaultMax: 400,
      smoothAlpha: 0.2,
      rawLimit: 4000,
    };
  if (rangeOrBucket === "day")
    return {
      source: "1h",
      interval: "1 hour",
      defaultMax: 360,
      smoothAlpha: 0.25,
      rawLimit: 4000,
    };
  if (rangeOrBucket === "month")
    return {
      source: "1h",
      interval: "1 hour",
      defaultMax: 300,
      smoothAlpha: 0.28,
      rawLimit: 4000,
    };

  switch (rangeOrBucket) {
    case "1h":
      return {
        source: "raw",
        interval: null,
        defaultMax: 480,
        smoothAlpha: 0.12,
        rawLimit: 3600,
      };
    case "24h":
      return {
        source: "5m",
        interval: "5 minutes",
        defaultMax: 420,
        smoothAlpha: 0.18,
        rawLimit: 4000,
      };
    case "7d":
      return {
        source: "5m",
        interval: "5 minutes",
        defaultMax: 400,
        smoothAlpha: 0.22,
        rawLimit: 4000,
      };
    case "30d":
      return {
        source: "1h",
        interval: "1 hour",
        defaultMax: 360,
        smoothAlpha: 0.25,
        rawLimit: 4000,
      };
    case "3m":
      return {
        source: "1h",
        interval: "1 hour",
        defaultMax: 320,
        smoothAlpha: 0.28,
        rawLimit: 4000,
      };
    case "6m":
      return {
        source: "1h",
        interval: "1 hour",
        defaultMax: 300,
        smoothAlpha: 0.3,
        rawLimit: 4000,
      };
    case "1y":
      return {
        source: "1h",
        interval: "1 hour",
        defaultMax: 366,
        smoothAlpha: 0.3,
        rawLimit: 4000,
      };
    default:
      return {
        source: "5m",
        interval: "15 minutes",
        defaultMax: 400,
        smoothAlpha: 0.22,
        rawLimit: 4000,
      };
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

export async function getReadingsInRange(
  from: string,
  to: string,
  rangeOrBucket?: string,
  maxPointsArg?: number,
  spanHours?: number,
): Promise<any[]> {
  if (!pool) return [];

  const plan = chartSourceForRange(rangeOrBucket, spanHours);
  const maxPoints = clampMaxPoints(maxPointsArg, plan.defaultMax);
  let rows: any[];

  if (plan.source === "raw" || !plan.interval) {
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
    rows = result.rows.map((row: any) => ({
      timestamp: new Date(row.time).toISOString(),
      voltage: Number(Number(row.voltage).toFixed(3)) || 0,
      power: Number(Number(row.power).toFixed(3)) || 0,
      current: Number(Number(row.current).toFixed(4)) || 0,
      temperature: Number(Number(row.temperature).toFixed(3)) || 0,
      humidity: Number(Number(row.humidity).toFixed(3)) || 0,
    }));
  } else {
    const view = plan.source === "1h" ? CAGG_1H : CAGG_5M;
    const useCagg = await caggHasRows(view, from, to);

    if (useCagg) {
      const result = await pool.query(
        `SELECT
          bucket,
          avg_voltage AS voltage,
          avg_power AS power,
          avg_current AS current,
          avg_temperature AS temperature,
          avg_humidity AS humidity
        FROM ${view}
        WHERE bucket >= $1 AND bucket <= $2
        ORDER BY bucket ASC`,
        [from, to],
      );
      rows = result.rows.map((row: any) => ({
        timestamp: new Date(row.bucket).toISOString(),
        voltage: Number(Number(row.voltage).toFixed(3)) || 0,
        power: Number(Number(row.power).toFixed(3)) || 0,
        current: Number(Number(row.current).toFixed(4)) || 0,
        temperature: Number(Number(row.temperature).toFixed(3)) || 0,
        humidity: Number(Number(row.humidity).toFixed(3)) || 0,
      }));
    } else {
      // Fallback: live time_bucket on raw hypertable
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
      rows = result.rows.map((row: any) => ({
        timestamp: new Date(row.bucket).toISOString(),
        voltage: Number(Number(row.voltage).toFixed(3)) || 0,
        power: Number(Number(row.power).toFixed(3)) || 0,
        current: Number(Number(row.current).toFixed(4)) || 0,
        temperature: Number(Number(row.temperature).toFixed(3)) || 0,
        humidity: Number(Number(row.humidity).toFixed(3)) || 0,
      }));
    }
  }

  let points = rows;

  // Shape-preserving downsample to ~2× pixel width
  if (points.length > maxPoints) {
    points = lttb(
      points,
      maxPoints,
      (p) => new Date(p.timestamp).getTime(),
      (p) => p.power,
    );
  }

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

/** Systematic sample — preserves time order. */
export function systematicSample<T>(items: T[], max: number): T[] {
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

/**
 * Analytics series — prefers continuous aggregates for ranges ≥ 24h.
 *
 * Coverage: the range window [from, to] is always respected (full 1y when
 * selected). Sampling is even across time (oldest → newest), not “latest N
 * only”, so a 1y selection still spans the whole year.
 *
 * Hourly CAGG for 1y is at most ~8760 buckets — classify all of them.
 * Only apply a hard ceiling when buckets explode (raw / 5m over long windows).
 */
export async function getAllReadingsForAnalytics(
  from: string,
  to: string,
  rangeOrBucket?: string,
  spanHours?: number,
): Promise<any[]> {
  if (!pool) return [];

  // Span-based resolution for custom From/To: ≤2h raw, ≤8d 5m, else 1h.
  const spanBased = spanHours != null;
  const longRange = spanBased
    ? spanHours > 2
    : ["24h", "7d", "30d", "3m", "6m", "1y", "day", "month"].includes(
        rangeOrBucket ?? "",
      );
  const prefer1h = spanBased
    ? spanHours > 192
    : ["30d", "3m", "6m", "1y", "month"].includes(rangeOrBucket ?? "");
  // 1y hourly ≈ 8760; keep full span. Ceiling only for denser series.
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
      // Even time coverage if we ever exceed the ceiling (not "last N only")
      if (points.length > maxClassify) {
        points = systematicSample(points, maxClassify);
      }
      return points;
    }
  }

  // Short range or CAGG miss: raw with hard limit (still ASC = full window start)
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

  // Fallback time_bucket on raw — full [from,to], then even sample if needed
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

/**
 * Energy (kWh) over [from, to] from the PZEM cumulative counter (`total_energy`).
 *
 * Firmware / Google Sheets / Timescale store this as **kWh** (not Wh): values
 * like 30.356, 30.357… match PZEM’s 1 Wh resolution reported as 0.001 kWh.
 * Do not divide by 1000 again.
 *
 * Handles meter resets: when the counter drops, treat it as a reset to 0 and
 * continue summing positive increments.
 *
 * Placeholder rows (every field = 0, i.e. the device was offline) are excluded
 * from the counter stream — otherwise a 0-blip between real readings (…63.967 →
 * 0 → 0 → 64.002…) is counted as +64 kWh per gap.
 * Returns null when there is no usable cumulative data (caller may fall back).
 */
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
         AND NOT (total_energy = 0 AND ac_power = 0 AND ac_current = 0 AND ac_voltage = 0)
     ),
     deltas AS (
       SELECT
         e,
         LAG(e) OVER (ORDER BY time ASC) AS prev
       FROM ordered
     )
     SELECT
       COUNT(*)::bigint AS n,
       COALESCE(SUM(
         CASE
           WHEN prev IS NULL THEN 0
           WHEN e + 1e-9 >= prev THEN e - prev
           ELSE e
         END
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

  // Firmware never populated the counter (always 0) → let caller fall back
  // to density-weighted power integration.
  if (maxE <= 0 && kwh <= 0) return null;

  // Counter present: report 0 when it didn't move in-range (do NOT invent
  // energy by multiplying sparse power samples by full bucket hours).
  return Math.max(0, kwh);
}

/** @deprecated Use getCumulativeEnergyKwh — total_energy is already kWh. */
export const getCumulativeEnergyWh = getCumulativeEnergyKwh;

/**
 * Density-weighted power integration (kWh) — fallback only when cumulative
 * energy is unavailable. Weights each CAGG bucket by how full it is so a
 * single sample in an hour is not treated as a full hour of that power.
 * Power is in W → Wh = W × hours → kWh = Wh / 1000.
 */
async function getIntegratedEnergyKwhFromCagg(
  view: string,
  from: string,
  to: string,
  bucket: "1h" | "5m",
): Promise<number> {
  if (!pool) return 0;
  // Nominal MQTT cadence ~every 5s → 720 samples/hour, 60 samples/5 min
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

/**
 * Fast SQL summary from continuous aggregates (no full series into Node).
 * Falls back to series-based stats if CAGG empty.
 */
export async function getEnergySummaryFromCagg(
  from: string,
  to: string,
  range: string,
  spanHours?: number,
): Promise<null | {
  dataPoints: number;
  timeSpan: { from: string; to: string };
  power: {
    average: number;
    median: number;
    stdDeviation: number;
    min: number;
    max: number;
  };
  voltage: { average: number };
  powerFactor: { average: number };
  reactivePower: { average: number; ratio: number };
  energy: { totalKwh: number; estimatedCost: string };
  peakHours: Array<{ hour: number; avgPower: number }>;
}> {
  if (!pool) return null;

  // Span-based: >192h (8d) → 1h, else 5m. Falls back to preset names when spanHours absent.
  const prefer1h = spanHours != null ? spanHours > 192 : ["30d", "3m", "6m", "1y"].includes(range);
  const view = prefer1h || range !== "1h" ? (prefer1h ? CAGG_1H : CAGG_5M) : null;
  if (!view || !(await caggHasRows(view, from, to))) return null;

  const bucketKind: "1h" | "5m" = prefer1h ? "1h" : "5m";

  // Weighted averages by sample count n (power/voltage stats only — not energy)
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

  // Prefer PZEM cumulative kWh (firmware / Sheets / Timescale unit). Fall back
  // to density-weighted power integration only when the counter is missing.
  const cumulativeKwh = await getCumulativeEnergyKwh(from, to);
  const totalKwhRaw =
    cumulativeKwh != null
      ? cumulativeKwh
      : await getIntegratedEnergyKwhFromCagg(view, from, to, bucketKind);

  // Approximate median/std from bucket avgs (weighted not exact; fine for UI)
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
      ? powers.reduce((a: number, p: number) => a + (p - avg) ** 2, 0) /
        powers.length
      : 0;

  const peak = await pool.query(
    `SELECT EXTRACT(HOUR FROM bucket)::int AS hour,
            AVG(avg_power) AS avg_power
     FROM ${view}
     WHERE bucket >= $1 AND bucket <= $2
     GROUP BY 1
     ORDER BY 1`,
    [from, to],
  );
  const peakMap = new Map<number, number>(
    peak.rows.map((r: any) => [Number(r.hour), Number(r.avg_power) || 0]),
  );
  const peakHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgPower: +(peakMap.get(hour) ?? 0).toFixed(2),
  }));

  const totalKwh = totalKwhRaw;
  const avgReactive = Number(s.avg_reactive) || 0;

  return {
    dataPoints: Number(s.data_points) || powers.length,
    timeSpan: {
      from: new Date(s.t_from).toISOString(),
      to: new Date(s.t_to).toISOString(),
    },
    power: {
      average: +avg.toFixed(2),
      median: +median.toFixed(2),
      stdDeviation: +Math.sqrt(variance).toFixed(2),
      min: +(Number(s.min_power) || 0).toFixed(2),
      max: +(Number(s.max_power) || 0).toFixed(2),
    },
    voltage: { average: +(Number(s.avg_voltage) || 0).toFixed(2) },
    powerFactor: { average: +(Number(s.avg_pf) || 0).toFixed(2) },
    reactivePower: {
      average: +avgReactive.toFixed(2),
      ratio: +(avgReactive / (avg || 1)).toFixed(3),
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
  maxPointsArg?: number,
): Promise<{ timestamp: string; energy_kwh: number }[]> {
  if (!pool) return [];

  const interval =
    bucketSize === "month"
      ? "1 month"
      : bucketSize === "day"
        ? "1 day"
        : "1 hour";

  // Prefer cumulative PZEM counter per outer bucket (`total_energy` is already
  // kWh from firmware). Global LAG keeps continuity across bucket edges; delta
  // is attributed to the later sample's bucket. Fall back to power when empty.
  // Placeholder rows (all fields 0 = device offline) are excluded so a 0-blip
  // between real readings is not counted as a full counter jump.
  const result = await pool.query(
    `WITH samples AS (
       SELECT
         time_bucket($3::interval, time) AS bucket,
         time,
         total_energy,
         ac_power
       FROM sensor_readings
       WHERE time >= $1 AND time <= $2
         AND NOT (total_energy = 0 AND ac_power = 0 AND ac_current = 0 AND ac_voltage = 0)
     ),
     energy_deltas AS (
       SELECT
         bucket,
         total_energy AS e,
         LAG(total_energy) OVER (ORDER BY time ASC) AS prev
       FROM samples
       WHERE total_energy IS NOT NULL
     ),
     energy_per_bucket AS (
       SELECT
         bucket,
         COALESCE(SUM(
           CASE
             WHEN prev IS NULL THEN 0
             WHEN e + 1e-9 >= prev THEN e - prev
             ELSE e
           END
         ), 0) AS energy_kwh
       FROM energy_deltas
       GROUP BY bucket
     ),
     power_per_bucket AS (
       SELECT
         bucket,
         AVG(ac_power) AS avg_power,
         COUNT(*)::float AS n
       FROM samples
       WHERE ac_power IS NOT NULL
       GROUP BY bucket
     )
     SELECT
       COALESCE(e.bucket, p.bucket) AS bucket,
       e.energy_kwh,
       p.avg_power,
       p.n
     FROM energy_per_bucket e
     FULL OUTER JOIN power_per_bucket p ON e.bucket = p.bucket
     ORDER BY 1 ASC`,
    [from, to, interval],
  );

  // Nominal samples per outer bucket (≈5s cadence) for density-weighted fallback
  const expectedN =
    bucketSize === "month"
      ? 720 * 24 * 30
      : bucketSize === "day"
        ? 720 * 24
        : 720;
  const fallbackHours =
    bucketSize === "month" ? 30 * 24 : bucketSize === "day" ? 24 : 1;

  let points = result.rows
    .filter((row: any) => row.bucket != null)
    .map((row: any) => {
      const cumulativeKwh = Number(row.energy_kwh) || 0;
      let energyKwh: number;
      if (cumulativeKwh > 0) {
        // total_energy is already kWh — use delta as-is
        energyKwh = cumulativeKwh;
      } else {
        // Density-weighted: avg_power (W) × effective hours → Wh → kWh
        const n = Number(row.n) || 0;
        const frac = Math.min(1, n / expectedN);
        const wh =
          (Number(row.avg_power) || 0) * fallbackHours * frac;
        energyKwh = wh / 1000;
      }
      return {
        timestamp: new Date(row.bucket).toISOString(),
        energy_kwh: +energyKwh.toFixed(4),
      };
    });

  const maxP = clampMaxPoints(maxPointsArg, 400);
  if (points.length > maxP) {
    points = lttb(
      points,
      maxP,
      (p) => new Date(p.timestamp).getTime(),
      (p) => p.energy_kwh,
    );
  }
  return points;
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

/** Export rows within an optional [from, to] window (both optional = all rows). */
export async function getExportDataInRange(
  from?: string,
  to?: string,
): Promise<any[]> {
  if (!pool) return [];
  const result = from || to
    ? await pool.query(
        `SELECT * FROM sensor_readings
         WHERE time >= COALESCE($1::timestamptz, '-infinity')
           AND time <= COALESCE($2::timestamptz, 'infinity')
         ORDER BY time ASC`,
        [from ?? null, to ?? null],
      )
    : await pool.query(`SELECT * FROM sensor_readings ORDER BY time ASC`);
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

