import type { FastifyInstance } from "fastify";
import {
  getAllReadingsForAnalytics,
  getCumulativeEnergyKwh,
  getEnergySummaryFromCagg,
  getExportData,
  getRangeConfig,
  formatEstimatedCost,
  mean,
  median,
  stdDev,
  sum,
} from "./db";
import {
  classifyEnergyDistribution,
  classifyClimateDistribution,
} from "@selene/shared/analytics/classify-batch";
import {
  generateMembershipData,
  generateDecisionSurface,
  generateBoxPlotData,
  generateBlandAltmanData,
  classifyEnergyFuzzy,
} from "@selene/shared/analytics/fuzzy";
import { badRequest } from "./envelope";

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  // ── Summary ───────────────────────────────────────────────
  app.get("/analytics/summary", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);

    const cagg = await getEnergySummaryFromCagg(
      from.toISOString(),
      to.toISOString(),
      range,
    );
    if (cagg) return { range, source: "cagg", ...cagg };

    const data = await getAllReadingsForAnalytics(
      from.toISOString(),
      to.toISOString(),
      range,
    );
    if (!data.length) return badRequest(reply, "No data in range");

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

    const cumulativeKwh = await getCumulativeEnergyKwh(
      from.toISOString(),
      to.toISOString(),
    );
    let totalEnergyKwh: number;
    if (cumulativeKwh != null) {
      totalEnergyKwh = cumulativeKwh;
    } else {
      totalEnergyKwh = 0;
      for (let i = 1; i < data.length; i++) {
        const dt =
          (new Date(data[i].timestamp).getTime() -
            new Date(data[i - 1].timestamp).getTime()) /
          3600000;
        const hours = Math.min(dt, 5 / 60);
        totalEnergyKwh +=
          ((data[i].acPower + data[i - 1].acPower) / 2000) * hours;
      }
    }

    const hourlyUsage = new Map<number, { power: number; count: number }>();
    for (const r of data) {
      const hour = new Date(r.timestamp).getHours();
      const h = hourlyUsage.get(hour) || { power: 0, count: 0 };
      h.power += r.acPower;
      h.count++;
      hourlyUsage.set(hour, h);
    }
    const peakHours = Array.from({ length: 24 }, (_, hour) => {
      const h = hourlyUsage.get(hour);
      return { hour, avgPower: h ? +(h.power / h.count).toFixed(2) : 0 };
    });

    return {
      range,
      source: "series",
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
        estimatedCost: formatEstimatedCost(totalEnergyKwh),
      },
      peakHours,
    };
  });

  // ── Energy fuzzy distribution ─────────────────────────────
  app.get("/analytics/fuzzy-distribution", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(from.toISOString(), to.toISOString(), range);
    if (!data.length) return badRequest(reply, "No data in range");
    return classifyEnergyDistribution(data);
  });

  // ── Climate analytics ─────────────────────────────────────
  app.get("/analytics/climate", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data = await getAllReadingsForAnalytics(
      from.toISOString(),
      to.toISOString(),
      range,
    );
    if (!data.length) return badRequest(reply, "No data in range");

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
    const sumTempSq = data.reduce((s: number, r: any) => s + r.temperature ** 2, 0);
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
        Math.max(0, (data[i].temperature + data[i - 1].temperature) / 2 - 18) * dt;
    }

    const comfortDist: Record<string, number> = {};
    for (const r of data) comfortDist[r.tempComfort] = (comfortDist[r.tempComfort] || 0) + 1;

    const hourlyClimate = new Map<number, { temp: number; hum: number; count: number }>();
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
      comfortDistribution: Object.entries(comfortDist).map(([status, count]) => ({
        status,
        count,
        percentage: +((count / data.length) * 100).toFixed(1),
      })),
      hourlyData,
    };
  });

  // ── Climate fuzzy distribution ────────────────────────────
  app.get("/analytics/climate-fuzzy-distribution", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(from.toISOString(), to.toISOString(), range);
    if (!data.length) return badRequest(reply, "No data in range");
    return classifyClimateDistribution(data);
  });

  // ── Fuzzy membership functions ─────────────────────────────
  app.get("/analytics/membership", async () => {
    return generateMembershipData();
  });

  // ── Decision surface grid ──────────────────────────────────
  app.get("/analytics/decision-surface", async () => {
    return generateDecisionSurface();
  });

  // ── Box plot data ──────────────────────────────────────────
  app.get("/analytics/box-plot", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(from.toISOString(), to.toISOString(), range);
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
  });

  // ── Bland-Altman analysis ──────────────────────────────────
  app.get("/analytics/bland-altman", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range ?? "7d";
    const { from, to } = getRangeConfig(range);
    const data =
      range === "all"
        ? await getExportData()
        : await getAllReadingsForAnalytics(from.toISOString(), to.toISOString(), range);
    if (!data.length) return { error: "No data" };
    const input = data.map((r: any) => ({
      voltage: r.acVoltage,
      power: r.acPower,
      pf: r.cosPhi,
      reactive: r.reactivePower,
    }));
    return generateBlandAltmanData(input);
  });
}