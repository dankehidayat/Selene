// apps/backend/src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { prisma } from "./db";
import { registerAuthRoutes } from "./routes/auth";
import { registerGlossaryRoutes } from "./routes/glossary";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerAdminRoutes } from "./routes/admin";
import {
  classifyEnergyFuzzy,
  classifyClimateFuzzy,
  generateMembershipData,
  generateDecisionSurface,
  generateBoxPlotData,
  generateBlandAltmanData,
} from "./analytics/fuzzy";
import {
  initTimescaleDB,
  insertReading,
  getLatestReading,
  getReadingsInRange,
  getRecentLogs,
  getAllReadingsForAnalytics,
  getExportData,
} from "./timescale";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [
    "http://localhost:5173",
    "https://selene.dankehidayat.my.id",
    "https://*.dankehidayat.my.id",
  ],
});

// ── Swagger/OpenAPI ───────────────────────────────────────
await app.register(swagger, {
  openapi: {
    info: {
      title: "Selene API",
      description:
        "Smart Energy & Climate Dashboard — real-time monitoring and analytics for ESP32-based IoT sensors.",
      version: "0.1.0",
    },
    servers: [
      { url: "https://selene.dankehidayat.my.id", description: "Production" },
      { url: "http://localhost:8787", description: "Local development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User registration, login, and profile management",
      },
      { name: "Admin", description: "Admin-only user management endpoints" },
      { name: "Readings", description: "Sensor data retrieval and export" },
      {
        name: "Analytics",
        description:
          "Statistical analysis, fuzzy classification, and visualizations",
      },
      {
        name: "Blynk Proxy",
        description: "Real-time sensor data from Blynk IoT",
      },
      { name: "Notifications", description: "User notification management" },
      { name: "Glossary", description: "Technical term definitions" },
      { name: "Health", description: "Service health check" },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
    persistAuthorization: true,
  },
  staticCSP: true,
});

await app.register(registerAuthRoutes);
await app.register(registerGlossaryRoutes);
await app.register(registerNotificationRoutes);
await app.register(registerAdminRoutes);

const BLYNK_SERVER_URL = process.env.BLYNK_SERVER_URL;
const BLYNK_AUTH_TOKEN = process.env.BLYNK_AUTH_TOKEN;

// ── Helpers ───────────────────────────────────────────────

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const mean = (arr: number[]) => (arr.length ? sum(arr) / arr.length : 0);
const median = (arr: number[]) => {
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
};
const stdDev = (arr: number[], avg: number) =>
  arr.length ? Math.sqrt(sum(arr.map((v) => (v - avg) ** 2)) / arr.length) : 0;

function getRangeConfig(range: string): {
  from: Date;
  to: Date;
  bucketSize: "hour" | "day" | "month" | null;
} {
  const now = new Date();
  switch (range) {
    case "1h":
      return {
        from: new Date(now.getTime() - 60 * 60 * 1000),
        to: now,
        bucketSize: null,
      };
    case "24h":
      return {
        from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "hour",
      };
    case "7d":
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "hour",
      };
    case "30d":
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "day",
      };
    case "3m":
      return {
        from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "day",
      };
    case "6m":
      return {
        from: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "month",
      };
    case "1y":
      return {
        from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "month",
      };
    default:
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
        bucketSize: "hour",
      };
  }
}

// ── Blynk Polling → TimescaleDB ──────────────────────────
async function pollBlynkToTimescale() {
  if (!BLYNK_SERVER_URL || !BLYNK_AUTH_TOKEN) return;

  try {
    const fetchPin = async (pin: number): Promise<number> => {
      const res = await fetch(
        `${BLYNK_SERVER_URL}/${BLYNK_AUTH_TOKEN}/get/v${pin}`,
      );
      const data = await res.json();
      const value = Array.isArray(data) ? data[0] : data;
      return Number(value) || 0;
    };

    const [
      acVoltage,
      acCurrent,
      acPower,
      cosPhi,
      apparentPower,
      totalEnergy,
      frequency,
      reactivePower,
      temperature,
      humidity,
    ] = await Promise.all([
      fetchPin(0),
      fetchPin(1),
      fetchPin(2),
      fetchPin(3),
      fetchPin(4),
      fetchPin(5),
      fetchPin(6),
      fetchPin(7),
      fetchPin(8),
      fetchPin(9),
    ]);

    if (acVoltage > 100) {
      await insertReading({
        time: new Date().toISOString(),
        acVoltage,
        acCurrent,
        acPower,
        cosPhi,
        apparentPower,
        totalEnergy,
        frequency,
        reactivePower,
        temperature,
        humidity,
        tempComfort: "COMFORTABLE",
        energyStatus: "2",
      });
    }
  } catch {
    // Silently fail — Blynk might be unreachable temporarily
  }
}

// ═══════════════════════════════════════════════════════════
//  Blynk Proxy
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/blynk/:pin",
  {
    schema: {
      description: "Proxy Blynk IoT sensor data by virtual pin",
      tags: ["Blynk Proxy"],
    },
  },
  async (request, reply) => {
    const { pin } = request.params as { pin: string };
    if (!BLYNK_SERVER_URL || !BLYNK_AUTH_TOKEN)
      return reply.code(500).send({ error: "Blynk not configured" });
    try {
      const response = await fetch(
        `${BLYNK_SERVER_URL}/${BLYNK_AUTH_TOKEN}/get/v${pin}`,
      );
      const data = await response.json();
      return data;
    } catch (error) {
      return reply.code(500).send({ error: "Blynk fetch failed" });
    }
  },
);

// ═══════════════════════════════════════════════════════════
//  Readings (from TimescaleDB)
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/readings/latest",
  {
    schema: {
      description: "Get the most recent sensor reading",
      tags: ["Readings"],
    },
  },
  async (request, reply) => {
    const latest = await getLatestReading();
    if (!latest) return reply.code(404).send({ error: "No readings found" });
    return {
      timestamp: latest.time,
      acVoltage: latest.ac_voltage,
      acCurrent: latest.ac_current,
      acPower: latest.ac_power,
      cosPhi: latest.cos_phi,
      apparentPower: latest.apparent_power,
      totalEnergy: latest.total_energy,
      frequency: latest.frequency,
      reactivePower: latest.reactive_power,
      temperature: latest.temperature,
      humidity: latest.humidity,
      tempComfort: latest.temp_comfort,
      energyStatus: latest.energy_status,
      powerQualityScore: latest.power_quality_score,
      voltageStability: latest.voltage_stability,
      currentPerKW: latest.current_per_kw,
      energyCost: latest.energy_cost,
    };
  },
);

app.get(
  "/api/readings/history",
  {
    schema: {
      description: "Get aggregated historical sensor data",
      tags: ["Readings"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "24h" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "24h";
    if (range === "1h") {
      const data = await getRecentLogs(60);
      return data.reverse().map((r: any) => ({
        timestamp: r.timestamp,
        voltage: r.acVoltage,
        power: r.acPower,
        current: r.acCurrent,
        temperature: r.temperature,
        humidity: r.humidity,
      }));
    }
    const { from, to, bucketSize } = getRangeConfig(range);
    return getReadingsInRange(
      from.toISOString(),
      to.toISOString(),
      bucketSize ?? undefined,
    );
  },
);

app.get(
  "/api/readings/logs",
  {
    schema: {
      description: "Get recent sensor readings for data log table",
      tags: ["Readings"],
      querystring: {
        type: "object",
        properties: { pageSize: { type: "string", default: "20" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { pageSize?: string };
    const pageSize = Number(query.pageSize ?? "20");
    return getRecentLogs(pageSize);
  },
);

app.get(
  "/api/readings/export",
  {
    schema: {
      description: "Export all sensor data as CSV or TSV file",
      tags: ["Readings"],
      querystring: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["csv", "tsv"], default: "csv" },
        },
      },
    },
  },
  async (request, reply) => {
    const query = request.query as { format?: string };
    const format = query.format ?? "csv";
    const data = await getExportData();
    if (!data.length)
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
    const rows = data.map((r: any) => [
      new Date(r.timestamp).toLocaleString(),
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
      const tsvContent = [
        headers.join("\t"),
        ...rows.map((r) => r.join("\t")),
      ].join("\n");
      return reply
        .header("Content-Type", "text/tab-separated-values")
        .header("Content-Disposition", `attachment; filename=${filename}`)
        .send(tsvContent);
    }
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    return reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", `attachment; filename=${filename}`)
      .send(csvContent);
  },
);

// ═══════════════════════════════════════════════════════════
//  Analytics (from TimescaleDB)
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/analytics/summary",
  {
    schema: {
      description: "Statistical summary of energy data",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data = await getAllReadingsForAnalytics(
      from.toISOString(),
      to.toISOString(),
    );
    if (!data.length) return { error: "No data in range" };

    const powers = data
      .map((r: any) => r.acPower)
      .sort((a: number, b: number) => a - b);
    const voltages = data.map((r: any) => r.acVoltage);
    const cosPhis = data.map((r: any) => r.cosPhi);
    const reactivePowers = data.map((r: any) => r.reactivePower);
    const avgPower = mean(powers),
      medPower = median(powers),
      stdPower = stdDev(powers, avgPower);
    const avgVoltage = mean(voltages),
      avgCosPhi = mean(cosPhis),
      avgReactive = mean(reactivePowers);

    let totalEnergyKwh = 0;
    for (let i = 1; i < data.length; i++) {
      const dt =
        (new Date(data[i].timestamp).getTime() -
          new Date(data[i - 1].timestamp).getTime()) /
        3600000;
      totalEnergyKwh += ((data[i].acPower + data[i - 1].acPower) / 2000) * dt;
    }

    const hourlyUsage = new Map<number, { power: number; count: number }>();
    for (const r of data) {
      const hour = new Date(r.timestamp).getHours();
      const h = hourlyUsage.get(hour) || { power: 0, count: 0 };
      h.power += r.acPower;
      h.count++;
      hourlyUsage.set(hour, h);
    }
    const peakHours = Array.from(hourlyUsage.entries())
      .map(([hour, d]) => ({ hour, avgPower: +(d.power / d.count).toFixed(2) }))
      .sort((a, b) => b.avgPower - a.avgPower)
      .slice(0, 3);

    return {
      range,
      dataPoints: data.length,
      timeSpan: {
        from: data[0].timestamp,
        to: data[data.length - 1].timestamp,
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
  },
);

app.get(
  "/api/analytics/climate",
  {
    schema: {
      description: "Climate analytics",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data = await getAllReadingsForAnalytics(
      from.toISOString(),
      to.toISOString(),
    );
    if (!data.length) return { error: "No data in range" };

    const temps = data
      .map((r: any) => r.temperature)
      .sort((a: number, b: number) => a - b);
    const hums = data
      .map((r: any) => r.humidity)
      .sort((a: number, b: number) => a - b);
    const avgTemp = mean(temps),
      avgHum = mean(hums);
    const dewPoints = data.map((r: any) => {
      const a = 17.27,
        b = 237.7;
      const alpha =
        (a * r.temperature) / (b + r.temperature) + Math.log(r.humidity / 100);
      return +((b * alpha) / (a - alpha)).toFixed(1);
    });
    const avgDewPoint = mean(dewPoints);

    const n = data.length;
    const sumTemp = sum(temps),
      sumHum = sum(hums);
    const sumTempHum = data.reduce(
      (s: number, r: any) => s + r.temperature * r.humidity,
      0,
    );
    const sumTempSq = data.reduce(
      (s: number, r: any) => s + r.temperature ** 2,
      0,
    );
    const sumHumSq = data.reduce((s: number, r: any) => s + r.humidity ** 2, 0);
    const num = n * sumTempHum - sumTemp * sumHum;
    const den = Math.sqrt(
      (n * sumTempSq - sumTemp ** 2) * (n * sumHumSq - sumHum ** 2),
    );
    const corrTempHum = den === 0 ? 0 : +(num / den).toFixed(3);

    let degreeHours = 0;
    for (let i = 1; i < data.length; i++) {
      const dt =
        (new Date(data[i].timestamp).getTime() -
          new Date(data[i - 1].timestamp).getTime()) /
        3600000;
      degreeHours +=
        Math.max(0, (data[i].temperature + data[i - 1].temperature) / 2 - 18) *
        dt;
    }

    const comfortDist: Record<string, number> = {};
    for (const r of data)
      comfortDist[r.tempComfort] = (comfortDist[r.tempComfort] || 0) + 1;

    const hourlyClimate = new Map<
      number,
      { temp: number; hum: number; count: number }
    >();
    for (const r of data) {
      const hour = new Date(r.timestamp).getHours();
      const h = hourlyClimate.get(hour) || { temp: 0, hum: 0, count: 0 };
      h.temp += r.temperature;
      h.hum += r.humidity;
      h.count++;
      hourlyClimate.set(hour, h);
    }
    const hourlyData = Array.from(hourlyClimate.entries())
      .map(([hour, d]) => ({
        hour,
        temperature: +(d.temp / d.count).toFixed(1),
        humidity: +(d.hum / d.count).toFixed(0),
      }))
      .sort((a, b) => a.hour - b.hour);

    return {
      range,
      dataPoints: data.length,
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
      comfortDistribution: Object.entries(comfortDist).map(
        ([status, count]) => ({
          status,
          count,
          percentage: +((count / data.length) * 100).toFixed(1),
        }),
      ),
      hourlyData,
    };
  },
);

app.get(
  "/api/analytics/fuzzy-distribution",
  {
    schema: {
      description: "Energy fuzzy classification distribution",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(
            from.toISOString(),
            to.toISOString(),
          );
    if (!data.length) return { error: "No data" };

    const results = data.map((r: any) => ({
      ...classifyEnergyFuzzy(r.acVoltage, r.acPower, r.cosPhi, r.reactivePower),
      timestamp: r.timestamp,
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
    return { distribution, total: data.length, scatterData, results };
  },
);

app.get(
  "/api/analytics/membership",
  {
    schema: {
      description: "Fuzzy membership function data",
      tags: ["Analytics"],
    },
  },
  async () => generateMembershipData(),
);

app.get(
  "/api/analytics/decision-surface",
  {
    schema: {
      description: "Fuzzy decision surface grid data",
      tags: ["Analytics"],
    },
  },
  async () => generateDecisionSurface(),
);

app.get(
  "/api/analytics/box-plot",
  {
    schema: {
      description: "Box plot data for power distribution",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(
            from.toISOString(),
            to.toISOString(),
          );
    if (!data.length) return [];
    const categorized = data.map((r: any) => ({
      power: r.acPower,
      category: classifyEnergyFuzzy(
        r.acVoltage,
        r.acPower,
        r.cosPhi,
        r.reactivePower,
      ).category,
    }));
    return generateBoxPlotData(categorized);
  },
);

app.get(
  "/api/analytics/bland-altman",
  {
    schema: {
      description: "Bland-Altman analysis",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(
            from.toISOString(),
            to.toISOString(),
          );
    if (!data.length) return { error: "No data" };
    const input = data.map((r: any) => ({
      voltage: r.acVoltage,
      power: r.acPower,
      pf: r.cosPhi,
      reactive: r.reactivePower,
    }));
    return generateBlandAltmanData(input);
  },
);

app.get(
  "/api/analytics/climate-fuzzy-distribution",
  {
    schema: {
      description: "Climate fuzzy classification distribution",
      tags: ["Analytics"],
      querystring: {
        type: "object",
        properties: { range: { type: "string", default: "7d" } },
      },
    },
  },
  async (request) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(
            from.toISOString(),
            to.toISOString(),
          );
    if (!data.length) return { error: "No data" };
    const results = data.map((r: any) => ({
      ...classifyClimateFuzzy(r.temperature, r.humidity),
      timestamp: r.timestamp,
      temperature: r.temperature,
      humidity: r.humidity,
    }));
    const distribution: Record<string, number> = {
      COLD: 0,
      COOL: 0,
      COMFORTABLE: 0,
      WARM: 0,
      HOT: 0,
    };
    const scatterData: Array<{
      temperature: number;
      humidity: number;
      category: string;
    }> = [];
    for (const r of results) {
      distribution[r.category]++;
      scatterData.push({
        temperature: r.temperature,
        humidity: r.humidity,
        category: r.category,
      });
    }
    return { distribution, total: data.length, scatterData, results };
  },
);

app.get(
  "/health",
  {
    schema: { description: "Health check endpoint", tags: ["Health"] },
  },
  async () => ({ status: "ok" }),
);

// ═══════════════════════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════════════════════
const port = Number(process.env.PORT ?? 8787);

await initTimescaleDB();

setInterval(pollBlynkToTimescale, 30_000);
setTimeout(pollBlynkToTimescale, 5_000);

try {
  await prisma.$connect();
  console.log("Connected to database");
} catch (error) {
  console.warn("Database connection failed:", error);
}
await app.listen({ port, host: "0.0.0.0" });
console.log(`Backend running on http://localhost:${port}`);
