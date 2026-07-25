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

/** Wrap node id so the UI can bold it (**node**). */
function nodeLabel(nodeId: string): string {
  return `**${nodeId}**`;
}

/**
 * Create energy/climate notifications for active users (deduped by title).
 * Messages are plain-language for non-technical readers.
 */
export async function evaluateSensorAlerts(
  input: SensorAlertInput,
): Promise<void> {
  const n = nodeLabel(input.nodeId);
  const alerts: Array<{
    type: "energy" | "climate";
    title: string;
    message: string;
  }> = [];

  // Energy
  if (input.energyCategory === "WASTEFUL") {
    alerts.push({
      type: "energy",
      title: "High electricity use",
      message: `${n} is using more electricity than usual right now (${input.acPower.toFixed(0)} W). Check whether large devices were left on or something is running harder than expected.`,
    });
  }
  if (input.acPower >= 80) {
    alerts.push({
      type: "energy",
      title: "Sudden power jump",
      message: `${n} just jumped to about ${input.acPower.toFixed(0)} W. Something may have turned on — take a quick look at nearby equipment if that was unexpected.`,
    });
  }
  if (input.cosPhi > 0 && input.cosPhi < 0.6 && input.acPower > 15) {
    alerts.push({
      type: "energy",
      title: "Inefficient power use",
      message: `${n} is not using electricity efficiently. Extra “wasted” load on the line is common with motors, compressors, or older gear — worth a check if this keeps happening.`,
    });
  }

  // Environment
  if (input.climateCategory === "HOT") {
    alerts.push({
      type: "climate",
      title: "Room feels hot",
      message: `${n} reports about ${input.temperature.toFixed(1)}°C with ${input.humidity.toFixed(0)}% humidity. The space may feel uncomfortably warm — cooling or better airflow can help.`,
    });
  }
  if (input.climateCategory === "COLD") {
    alerts.push({
      type: "climate",
      title: "Room feels cold",
      message: `${n} reports about ${input.temperature.toFixed(1)}°C. The space may feel chilly — heating or reducing drafts can help.`,
    });
  }
  if (input.humidity >= 75) {
    alerts.push({
      type: "climate",
      title: "Air is very humid",
      message: `${n} humidity is around ${input.humidity.toFixed(0)}%. The air may feel sticky — open a window or use a dehumidifier if you can.`,
    });
  }
  if (input.temperature >= 32) {
    alerts.push({
      type: "climate",
      title: "Temperature is high",
      message: `${n} is about ${input.temperature.toFixed(1)}°C — warmer than a comfortable desk environment. Cooling or shade may help.`,
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
