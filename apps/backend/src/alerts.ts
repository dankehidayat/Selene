// apps/backend/src/alerts.ts — sensor-driven user notifications
import { prisma } from "./db";

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours per title per user

interface SensorAlertInput {
  nodeId: string;
  acPower: number;
  cosPhi: number;
  temperature: number;
  humidity: number;
  energyCategory: string;
  climateCategory: string;
}

/**
 * Create energy/climate notifications for active users (deduped by title).
 * Called from MQTT ingest after a successful reading.
 */
export async function evaluateSensorAlerts(input: SensorAlertInput): Promise<void> {
  const alerts: Array<{
    type: "energy" | "climate";
    title: string;
    message: string;
  }> = [];

  // Energy
  if (input.energyCategory === "WASTEFUL") {
    alerts.push({
      type: "energy",
      title: "High energy use detected",
      message: `Node ${input.nodeId}: power ${input.acPower.toFixed(0)} W classified as WASTEFUL. Check loads and power factor.`,
    });
  }
  if (input.acPower >= 80) {
    alerts.push({
      type: "energy",
      title: "Power spike",
      message: `Node ${input.nodeId}: active power reached ${input.acPower.toFixed(1)} W.`,
    });
  }
  if (input.cosPhi > 0 && input.cosPhi < 0.6 && input.acPower > 15) {
    alerts.push({
      type: "energy",
      title: "Low power factor",
      message: `Node ${input.nodeId}: cos φ = ${input.cosPhi.toFixed(2)}. Significant reactive power present.`,
    });
  }

  // Environment
  if (input.climateCategory === "HOT") {
    alerts.push({
      type: "climate",
      title: "Hot environment",
      message: `Node ${input.nodeId}: ${input.temperature.toFixed(1)}°C / ${input.humidity.toFixed(0)}% RH — thermal comfort is HOT.`,
    });
  }
  if (input.climateCategory === "COLD") {
    alerts.push({
      type: "climate",
      title: "Cold environment",
      message: `Node ${input.nodeId}: ${input.temperature.toFixed(1)}°C — thermal comfort is COLD.`,
    });
  }
  if (input.humidity >= 75) {
    alerts.push({
      type: "climate",
      title: "High humidity",
      message: `Node ${input.nodeId}: humidity ${input.humidity.toFixed(0)}% RH. Consider ventilation.`,
    });
  }
  if (input.temperature >= 32) {
    alerts.push({
      type: "climate",
      title: "High temperature",
      message: `Node ${input.nodeId}: temperature ${input.temperature.toFixed(1)}°C exceeds comfort threshold.`,
    });
  }

  if (alerts.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (users.length === 0) return;

    const since = new Date(Date.now() - COOLDOWN_MS);

    for (const alert of alerts) {
      for (const user of users) {
        const exists = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: alert.type,
            title: alert.title,
            createdAt: { gte: since },
          },
          select: { id: true },
        });
        if (exists) continue;

        await prisma.notification.create({
          data: {
            userId: user.id,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            read: false,
          },
        });
      }
    }
  } catch (err) {
    console.warn("[alerts] failed to create notifications:", err);
  }
}
