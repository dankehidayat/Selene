// apps/backend/src/mqtt.ts
import mqtt from "mqtt";
import { insertReading } from "./timescale";
import { classifyEnergyFuzzy, classifyClimateFuzzy } from "./analytics/fuzzy";

const MQTT_HOST = process.env.MQTT_HOST || "localhost";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "1883");
const TOPIC = process.env.MQTT_TOPIC || "selene/+/telemetry";

let client: mqtt.MqttClient | null = null;

export function startMqttIngestor() {
  if (client) return;

  client = mqtt.connect({
    host: MQTT_HOST,
    port: MQTT_PORT,
    clientId: `selene-backend-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  });

  client.on("connect", () => {
    console.log(`[MQTT] Connected to broker at ${MQTT_HOST}:${MQTT_PORT}`);
    client!.subscribe(TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error("[MQTT] Subscribe error:", err);
      } else {
        console.log(`[MQTT] Subscribed to topic: ${TOPIC}`);
      }
    });
  });

  client.on("error", (err) => {
    console.error("[MQTT] Connection error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");
  });

  client.on("message", async (topic, message) => {
    // Extract node_id from topic: selene/{node_id}/telemetry
    const topicParts = topic.split("/");
    const nodeId = topicParts.length >= 2 ? topicParts[1] : "unknown";

    let payload: any;
    try {
      payload = JSON.parse(message.toString());
    } catch (err) {
      console.warn(`[MQTT] Invalid JSON from node "${nodeId}":`, err);
      return;
    }

    // Only process if we have valid sensor data
    const hasEnergyData =
      payload.voltage !== undefined || payload.power !== undefined;
    const hasClimateData =
      payload.temperature !== undefined || payload.humidity !== undefined;

    if (!hasEnergyData && !hasClimateData) {
      return; // No sensor data in payload
    }

    const timestamp = new Date().toISOString();
    const acVoltage = Number(payload.voltage ?? 0);
    const acCurrent = Number(payload.current ?? 0);
    const acPower = Number(payload.power ?? 0);
    const cosPhi = Number(payload.pf ?? payload.powerFactor ?? 0);
    const frequency = Number(payload.frequency ?? 0);
    const totalEnergy = Number(payload.energy ?? payload.totalEnergy ?? 0);
    const temperature = Number(payload.temperature ?? 0);
    const humidity = Number(payload.humidity ?? 0);
    const reactivePower = Number(payload.reactivePower ?? 0);
    const apparentPower = cosPhi > 0 ? acPower / cosPhi : 0;

    // Only insert if we have meaningful data (voltage > 100V or power > 0)
    if (acVoltage < 100 && acPower === 0) {
      return;
    }

    // Run fuzzy classification
    const energyFuzzy = classifyEnergyFuzzy(
      acVoltage,
      acPower,
      cosPhi,
      reactivePower,
    );

    const climateFuzzy = classifyClimateFuzzy(temperature, humidity);

    // Map energy status to numeric string
    const energyStatus =
      energyFuzzy.category === "ECONOMICAL"
        ? "1"
        : energyFuzzy.category === "NORMAL"
          ? "2"
          : "3";

    console.log(
      `[MQTT] ${nodeId} | V:${acVoltage.toFixed(1)}V P:${acPower.toFixed(1)}W ` +
        `T:${temperature.toFixed(1)}°C H:${humidity.toFixed(0)}% ` +
        `Energy:${energyFuzzy.category} Climate:${climateFuzzy.category}`,
    );

    try {
      await insertReading({
        time: timestamp,
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
        tempComfort: climateFuzzy.category,
        energyStatus,
      });
    } catch (err) {
      console.error(`[MQTT] Failed to insert reading for ${nodeId}:`, err);
    }
  });
}

export function stopMqttIngestor() {
  if (client) {
    client.end(true);
    client = null;
    console.log("[MQTT] Ingestor stopped");
  }
}
