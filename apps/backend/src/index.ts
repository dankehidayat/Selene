// [apps/backend] src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db";
import { registerAuthRoutes } from "./routes/auth";
import { registerGlossaryRoutes } from "./routes/glossary";
import {
  classifyEnergyFuzzy,
  generateMembershipData,
  generateDecisionSurface,
  generateBoxPlotData,
  generateBlandAltmanData,
} from "./analytics/fuzzy";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [
    "http://localhost:5173",
    "https://selene.dankehidayat.my.id",
    "https://*.dankehidayat.my.id",
  ],
});
await app.register(registerAuthRoutes);
await app.register(registerGlossaryRoutes);

// ==================== GOOGLE SHEETS / BLYNK CODE ====================

const SHEET_CSV_URL = process.env.SHEET_CSV_URL;
if (!SHEET_CSV_URL) {
  console.error("SHEET_CSV_URL is not set in .env");
  process.exit(1);
}

interface Reading {
  timestamp: string;
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
  parsedTs?: Date;
}

let cachedData: Reading[] = [];
let lastFetch = 0;
const CACHE_TTL = 30_000;

function parseSheetTimestamp(ts: string): Date | null {
  if (!ts) return null;
  const match = ts.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/,
  );
  if (match) {
    const [, month, day, year, hour, minute, second] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function parseCSV(csv: string): Reading[] {
  const lines = csv.split("\n");
  if (lines.length < 2) return [];
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cols: string[] = [];
      let current = "",
        inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cols.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cols.push(current.trim());
      const get = (i: number) => cols[i]?.replace(/"/g, "") ?? "";
      const rawTs = get(0);
      const parsedTs = parseSheetTimestamp(rawTs);
      return {
        timestamp: rawTs,
        acVoltage: parseFloat(get(1)) || 0,
        acCurrent: parseFloat(get(2)) || 0,
        acPower: parseFloat(get(3)) || 0,
        cosPhi: parseFloat(get(4)) || 0,
        apparentPower: parseFloat(get(5)) || 0,
        totalEnergy: parseFloat(get(6)) || 0,
        frequency: parseFloat(get(7)) || 0,
        reactivePower: parseFloat(get(8)) || 0,
        temperature: parseFloat(get(9)) || 0,
        humidity: parseFloat(get(10)) || 0,
        tempComfort: get(11) || "COMFORTABLE",
        energyStatus: get(12) || "2",
        currentPerKW: parseFloat(get(13)) || undefined,
        powerQualityScore: parseFloat(get(14)) || undefined,
        energyCost: get(15) || undefined,
        voltageStability: parseFloat(get(16)) || undefined,
        parsedTs: parsedTs || undefined,
      };
    });
}

async function fetchSheetData(): Promise<Reading[]> {
  if (Date.now() - lastFetch < CACHE_TTL) return cachedData;
  try {
    const response = await fetch(SHEET_CSV_URL!);
    const csv = await response.text();
    cachedData = parseCSV(csv);
    lastFetch = Date.now();
    console.log(`Fetched ${cachedData.length} rows from Google Sheets`);
  } catch (error) {
    console.error("Failed to fetch sheet data:", error);
  }
  return cachedData;
}

function normalizeEnergyStatus(status: string): "1" | "2" | "3" {
  const upper = status?.toUpperCase() || "2";
  if (upper === "ECONOMICAL" || upper === "1") return "1";
  if (upper === "NORMAL" || upper === "2") return "2";
  if (upper === "WASTEFUL" || upper === "3") return "3";
  return "2";
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const mean = (arr: number[]) => sum(arr) / arr.length;
const median = (arr: number[]) => {
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
};
const stdDev = (arr: number[], avg: number) =>
  Math.sqrt(sum(arr.map((v) => (v - avg) ** 2)) / arr.length);

function getRangeConfig(range: string): {
  from: Date;
  bucketSize: "hour" | "day" | "month";
} {
  const now = new Date();
  switch (range) {
    case "1h":
      return {
        from: new Date(now.getTime() - 60 * 60 * 1000),
        bucketSize: "hour",
      };
    case "24h":
      return {
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        bucketSize: "hour",
      };
    case "7d":
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        bucketSize: "hour",
      };
    case "30d":
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        bucketSize: "day",
      };
    case "3m":
      return {
        from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        bucketSize: "day",
      };
    case "6m":
      return {
        from: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        bucketSize: "month",
      };
    case "1y":
      return {
        from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        bucketSize: "month",
      };
    default:
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        bucketSize: "hour",
      };
  }
}

// ==================== API ROUTES ====================

// Latest reading
app.get("/api/readings/latest", async (request, reply) => {
  const data = await fetchSheetData();
  if (data.length === 0)
    return reply.code(404).send({ error: "No readings found" });
  const latest = data[data.length - 1];
  return {
    timestamp: latest.parsedTs?.toISOString() || latest.timestamp,
    acVoltage: latest.acVoltage,
    acCurrent: latest.acCurrent,
    acPower: latest.acPower,
    cosPhi: latest.cosPhi,
    apparentPower: latest.apparentPower,
    totalEnergy: latest.totalEnergy,
    frequency: latest.frequency,
    reactivePower: latest.reactivePower,
    temperature: latest.temperature,
    humidity: latest.humidity,
    tempComfort: latest.tempComfort,
    energyStatus: normalizeEnergyStatus(latest.energyStatus),
    powerQualityScore: latest.powerQualityScore,
    voltageStability: latest.voltageStability,
    currentPerKW: latest.currentPerKW,
    energyCost: latest.energyCost,
  };
});

// History for charts
app.get("/api/readings/history", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "24h";
  const data = await fetchSheetData();
  if (data.length === 0) return [];

  const valid = data.filter((r: Reading) => r.parsedTs);
  if (valid.length === 0) return [];
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );

  const { from, bucketSize } = getRangeConfig(range);
  const filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  if (filtered.length === 0) {
    return valid.slice(-50).map((r: Reading) => ({
      timestamp: r.parsedTs!.toISOString(),
      voltage: r.acVoltage,
      power: r.acPower,
      temperature: r.temperature,
      humidity: r.humidity,
    }));
  }

  const buckets = new Map<
    string,
    {
      voltage: number;
      power: number;
      temperature: number;
      humidity: number;
      count: number;
      timestamp: string;
    }
  >();
  for (const row of filtered) {
    let key: string;
    if (bucketSize === "month") key = row.parsedTs!.toISOString().slice(0, 7);
    else if (bucketSize === "day")
      key = row.parsedTs!.toISOString().slice(0, 10);
    else key = row.parsedTs!.toISOString().slice(0, 13);

    const existing = buckets.get(key);
    if (existing) {
      existing.voltage += row.acVoltage;
      existing.power += row.acPower;
      existing.temperature += row.temperature;
      existing.humidity += row.humidity;
      existing.count++;
    } else {
      let bucketTimestamp: string;
      if (bucketSize === "month") bucketTimestamp = `${key}-01T12:00:00.000Z`;
      else if (bucketSize === "day") bucketTimestamp = `${key}T12:00:00.000Z`;
      else bucketTimestamp = `${key}:00:00.000Z`;
      buckets.set(key, {
        timestamp: bucketTimestamp,
        voltage: row.acVoltage,
        power: row.acPower,
        temperature: row.temperature,
        humidity: row.humidity,
        count: 1,
      });
    }
  }

  let result = Array.from(buckets.values())
    .map((b) => ({
      timestamp: b.timestamp,
      voltage: +(b.voltage / b.count).toFixed(2),
      power: +(b.power / b.count).toFixed(2),
      temperature: +(b.temperature / b.count).toFixed(2),
      humidity: +(b.humidity / b.count).toFixed(2),
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  if (result.length > 2000) {
    const step = Math.ceil(result.length / 2000);
    result = result.filter((_, i) => i % step === 0);
  }

  return result;
});

// Recent readings (for Data Log)
app.get("/api/readings/logs", async (request) => {
  const query = request.query as { pageSize?: string };
  const pageSize = Number(query.pageSize ?? "20");
  const data = await fetchSheetData();
  return data
    .slice(-pageSize)
    .reverse()
    .map((r: Reading) => ({
      timestamp: r.parsedTs?.toISOString() || r.timestamp,
      acVoltage: r.acVoltage,
      acCurrent: r.acCurrent,
      acPower: r.acPower,
      cosPhi: r.cosPhi,
      apparentPower: r.apparentPower,
      totalEnergy: r.totalEnergy,
      frequency: r.frequency,
      reactivePower: r.reactivePower,
      temperature: r.temperature,
      humidity: r.humidity,
      tempComfort: r.tempComfort,
      energyStatus: normalizeEnergyStatus(r.energyStatus),
      powerQualityScore: r.powerQualityScore,
      voltageStability: r.voltageStability,
    }));
});

// Export readings
app.get("/api/readings/export", async (request, reply) => {
  const query = request.query as { format?: string };
  const format = query.format ?? "csv";
  const data = await fetchSheetData();
  if (data.length === 0)
    return reply.code(404).send({ error: "No data available" });

  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const headers = [
    "Timestamp",
    "AC Voltage (V)",
    "AC Current (A)",
    "AC Power (W)",
    "Cos Phi",
    "Apparent Power (VA)",
    "Total Energy (Wh)",
    "Frequency (Hz)",
    "Reactive Power (VAR)",
    "Temperature (°C)",
    "Humidity (%)",
    "Temp Comfort",
    "Energy Status",
  ];
  const rows = data.map((r: Reading) => [
    r.timestamp,
    r.acVoltage,
    r.acCurrent,
    r.acPower,
    r.cosPhi,
    r.apparentPower,
    r.totalEnergy,
    r.frequency,
    r.reactivePower,
    r.temperature,
    r.humidity,
    r.tempComfort,
    r.energyStatus,
  ]);

  const ext = format === "tsv" ? "tsv" : "csv";
  const filename = `sensor-data-${ts}.${ext}`;
  if (format === "tsv") {
    const tsv = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join(
      "\n",
    );
    return reply
      .header("Content-Type", "text/tab-separated-values")
      .header("Content-Disposition", `attachment; filename=${filename}`)
      .send(tsv);
  }
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  return reply
    .header("Content-Type", "text/csv")
    .header("Content-Disposition", `attachment; filename=${filename}`)
    .send(csv);
});

// Analytics summary
app.get("/api/analytics/summary", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "7d";
  const data = await fetchSheetData();
  if (data.length === 0) return { error: "No data" };
  const valid = data.filter((r: Reading) => r.parsedTs);
  if (valid.length === 0) return { error: "No valid timestamps" };
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );
  const { from } = getRangeConfig(range);
  const filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  if (filtered.length === 0) return { error: "No data in range" };

  const powers = filtered.map((r: Reading) => r.acPower).sort((a, b) => a - b);
  const voltages = filtered.map((r: Reading) => r.acVoltage);
  const cosPhis = filtered.map((r: Reading) => r.cosPhi);
  const reactivePowers = filtered.map((r: Reading) => r.reactivePower);
  const avgPower = mean(powers),
    medPower = median(powers),
    stdPower = stdDev(powers, avgPower);
  const avgVoltage = mean(voltages),
    avgCosPhi = mean(cosPhis),
    avgReactive = mean(reactivePowers);

  let totalEnergyKwh = 0;
  for (let i = 1; i < filtered.length; i++) {
    const dt =
      (filtered[i].parsedTs!.getTime() - filtered[i - 1].parsedTs!.getTime()) /
      3600000;
    totalEnergyKwh +=
      ((filtered[i].acPower + filtered[i - 1].acPower) / 2000) * dt;
  }

  const hourlyUsage = new Map<number, { power: number; count: number }>();
  for (const r of filtered) {
    const hour = r.parsedTs!.getHours();
    const h = hourlyUsage.get(hour) || { power: 0, count: 0 };
    h.power += r.acPower;
    h.count++;
    hourlyUsage.set(hour, h);
  }
  const peakHours = Array.from(hourlyUsage.entries())
    .map(([hour, data]) => ({
      hour,
      avgPower: +(data.power / data.count).toFixed(2),
    }))
    .sort((a, b) => b.avgPower - a.avgPower)
    .slice(0, 3);

  return {
    range,
    dataPoints: filtered.length,
    timeSpan: {
      from: filtered[0].parsedTs!.toISOString(),
      to: filtered[filtered.length - 1].parsedTs!.toISOString(),
    },
    power: {
      average: +avgPower.toFixed(2),
      median: +medPower.toFixed(2),
      stdDeviation: +stdPower.toFixed(2),
      min: powers[0],
      max: powers[powers.length - 1],
    },
    voltage: { average: +avgVoltage.toFixed(2) },
    powerFactor: { average: +avgCosPhi.toFixed(2) },
    reactivePower: {
      average: +avgReactive.toFixed(2),
      ratio: +(avgReactive / (avgPower || 1)).toFixed(3),
    },
    energy: {
      totalKwh: +totalEnergyKwh.toFixed(3),
      estimatedCost: `Rp ${Math.round(totalEnergyKwh * 1444.7).toLocaleString()}`,
    },
    peakHours,
  };
});

// Climate analytics
app.get("/api/analytics/climate", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "7d";
  const data = await fetchSheetData();
  if (data.length === 0) return { error: "No data" };
  const valid = data.filter((r: Reading) => r.parsedTs);
  if (valid.length === 0) return { error: "No valid timestamps" };
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );
  const { from } = getRangeConfig(range);
  const filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  if (filtered.length === 0) return { error: "No data in range" };

  const temps = filtered
    .map((r: Reading) => r.temperature)
    .sort((a, b) => a - b);
  const hums = filtered.map((r: Reading) => r.humidity).sort((a, b) => a - b);
  const avgTemp = mean(temps),
    avgHum = mean(hums);

  const dewPoints = filtered.map((r: Reading) => {
    const a = 17.27,
      b = 237.7;
    const alpha =
      (a * r.temperature) / (b + r.temperature) + Math.log(r.humidity / 100);
    return +((b * alpha) / (a - alpha)).toFixed(1);
  });
  const avgDewPoint = mean(dewPoints);

  let corrTempHum = 0;
  const n = filtered.length;
  const sumTemp = sum(temps),
    sumHum = sum(hums);
  const sumTempHum = filtered.reduce(
    (s, r) => s + r.temperature * r.humidity,
    0,
  );
  const sumTempSq = filtered.reduce((s, r) => s + r.temperature ** 2, 0);
  const sumHumSq = filtered.reduce((s, r) => s + r.humidity ** 2, 0);
  const num = n * sumTempHum - sumTemp * sumHum;
  const den = Math.sqrt(
    (n * sumTempSq - sumTemp ** 2) * (n * sumHumSq - sumHum ** 2),
  );
  corrTempHum = den === 0 ? 0 : +(num / den).toFixed(3);

  let degreeHours = 0;
  for (let i = 1; i < filtered.length; i++) {
    const dt =
      (filtered[i].parsedTs!.getTime() - filtered[i - 1].parsedTs!.getTime()) /
      3600000;
    degreeHours +=
      Math.max(
        0,
        (filtered[i].temperature + filtered[i - 1].temperature) / 2 - 18,
      ) * dt;
  }

  const comfortDist: Record<string, number> = {};
  for (const r of filtered)
    comfortDist[r.tempComfort] = (comfortDist[r.tempComfort] || 0) + 1;

  const hourlyClimate = new Map<
    number,
    { temp: number; hum: number; count: number }
  >();
  for (const r of filtered) {
    const hour = r.parsedTs!.getHours();
    const h = hourlyClimate.get(hour) || { temp: 0, hum: 0, count: 0 };
    h.temp += r.temperature;
    h.hum += r.humidity;
    h.count++;
    hourlyClimate.set(hour, h);
  }
  const hourlyData = Array.from(hourlyClimate.entries())
    .map(([hour, data]) => ({
      hour,
      temperature: +(data.temp / data.count).toFixed(1),
      humidity: +(data.hum / data.count).toFixed(0),
    }))
    .sort((a, b) => a.hour - b.hour);

  return {
    range,
    dataPoints: filtered.length,
    temperature: {
      average: +avgTemp.toFixed(2),
      median: +median(temps).toFixed(2),
      stdDeviation: +stdDev(temps, avgTemp).toFixed(2),
      min: temps[0],
      max: temps[temps.length - 1],
      degreeHours: +degreeHours.toFixed(1),
    },
    humidity: {
      average: +avgHum.toFixed(2),
      median: +median(hums).toFixed(2),
      stdDeviation: +stdDev(hums, avgHum).toFixed(2),
      min: hums[0],
      max: hums[hums.length - 1],
    },
    dewPoint: { average: +avgDewPoint.toFixed(1) },
    correlation: { tempHumidity: corrTempHum },
    comfortDistribution: Object.entries(comfortDist).map(([status, count]) => ({
      status,
      count,
      percentage: +((count / filtered.length) * 100).toFixed(1),
    })),
    hourlyData,
  };
});

// Fuzzy distribution
app.get("/api/analytics/fuzzy-distribution", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "7d";
  const data = await fetchSheetData();
  if (data.length === 0) return { error: "No data" };
  const valid = data.filter((r: Reading) => r.parsedTs);
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );
  let filtered = valid;
  if (range !== "all") {
    const { from } = getRangeConfig(range);
    filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  }

  const results = filtered.map((r: Reading) => ({
    ...classifyEnergyFuzzy(r.acVoltage, r.acPower, r.cosPhi, r.reactivePower),
    timestamp: r.parsedTs?.toISOString() || r.timestamp,
    power: r.acPower,
    powerFactor: r.cosPhi,
    voltage: r.acVoltage,
    reactivePower: r.reactivePower,
  }));
  const distribution: Record<string, number> = {
    ECONOMICAL: 0,
    NORMAL: 0,
    WASTEFUL: 0,
  };
  const scatterData: Array<{
    power: number;
    powerFactor: number;
    category: string;
  }> = [];
  for (const r of results) {
    distribution[r.category]++;
    scatterData.push({
      power: r.power,
      powerFactor: r.powerFactor,
      category: r.category,
    });
  }
  return { distribution, total: filtered.length, scatterData, results };
});

// Membership data
app.get("/api/analytics/membership", async () => {
  return generateMembershipData();
});

// Decision surface
app.get("/api/analytics/decision-surface", async () => {
  return generateDecisionSurface();
});

// Box plot
app.get("/api/analytics/box-plot", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "7d";
  const data = await fetchSheetData();
  const valid = data.filter((r: Reading) => r.parsedTs);
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );
  let filtered = valid;
  if (range !== "all") {
    const { from } = getRangeConfig(range);
    filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  }
  const categorized = filtered.map((r: Reading) => ({
    power: r.acPower,
    category: classifyEnergyFuzzy(
      r.acVoltage,
      r.acPower,
      r.cosPhi,
      r.reactivePower,
    ).category,
  }));
  return generateBoxPlotData(categorized);
});

// Bland-Altman
app.get("/api/analytics/bland-altman", async (request) => {
  const query = request.query as { range?: string };
  const range = query.range ?? "7d";
  const data = await fetchSheetData();
  const valid = data.filter((r: Reading) => r.parsedTs);
  valid.sort(
    (a: Reading, b: Reading) => a.parsedTs!.getTime() - b.parsedTs!.getTime(),
  );
  let filtered = valid;
  if (range !== "all") {
    const { from } = getRangeConfig(range);
    filtered = valid.filter((r: Reading) => r.parsedTs! >= from);
  }
  const input = filtered.map((r: Reading) => ({
    voltage: r.acVoltage,
    power: r.acPower,
    pf: r.cosPhi,
    reactive: r.reactivePower,
  }));
  return generateBlandAltmanData(input);
});

// Health check
app.get("/health", async () => ({
  status: "ok",
  cachedRows: cachedData.length,
}));

// ==================== START SERVER ====================

const port = Number(process.env.PORT ?? 8787);
try {
  await prisma.$connect();
  console.log("Connected to database");
} catch (error) {
  console.warn("Database connection failed:", error);
}
await app.listen({ port, host: "0.0.0.0" });
console.log(`Backend running on http://localhost:${port}`);
