// apps/backend/src/mqtt.ts
import mqtt from "mqtt";
import { insertReading } from "./timescale";
import { classifyEnergyFuzzy, classifyClimateFuzzy } from "./analytics/fuzzy";
import { emitNewReading } from "./events";

const MQTT_HOST = process.env.MQTT_HOST || "localhost";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "1883");
const TOPIC = process.env.MQTT_TOPIC || "selene/+/telemetry";
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

let client: mqtt.MqttClient | null = null;

export function startMqttIngestor() {
  if (client) return;

  const options: mqtt.IClientOptions = {
    host: MQTT_HOST,
    port: MQTT_PORT,
    clientId: `selene-backend-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  };

  if (MQTT_USER && MQTT_PASSWORD) {
    options.username = MQTT_USER;
    options.password = MQTT_PASSWORD;
  }

  client = mqtt.connect(options);

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
    const topicParts = topic.split("/");
    const nodeId = topicParts.length >= 2 ? topicParts[1] : "unknown";

    let payload: any;
    try {
      payload = JSON.parse(message.toString());
    } catch (err) {
      console.warn(`[MQTT] Invalid JSON from node "${nodeId}":`, err);
      return;
    }

    const voltage = Number(payload.voltage ?? 0);
    const acCurrent = Number(payload.current ?? 0);
    const acPower = Number(payload.power ?? 0);
    const cosPhi = Number(payload.pf ?? 0);
    const frequency = Number(payload.frequency ?? 0);
    const totalEnergy = Number(payload.energy ?? 0);
    const temperature = Number(payload.temperature ?? 0);
    const humidity = Number(payload.humidity ?? 0);

    const reactivePower = Number(
      payload.reactive_power ?? payload.reactivePower ?? 0,
    );
    const apparentPower = Number(
      payload.apparent_power ??
        payload.apparentPower ??
        (cosPhi > 0 ? acPower / cosPhi : 0),
    );

    if (voltage < 100 && acPower === 0) {
      return;
    }

    const energyFuzzy = classifyEnergyFuzzy(
      voltage,
      acPower,
      cosPhi,
      reactivePower,
    );

    const climateFuzzy = classifyClimateFuzzy(temperature, humidity);

    const energyStatus =
      energyFuzzy.category === "ECONOMICAL"
        ? "1"
        : energyFuzzy.category === "NORMAL"
          ? "2"
          : "3";

    console.log(
      `[MQTT] ${nodeId} | V:${voltage.toFixed(1)}V P:${acPower.toFixed(1)}W ` +
        `T:${temperature.toFixed(1)}°C H:${humidity.toFixed(0)}% ` +
        `Energy:${energyFuzzy.category} Climate:${climateFuzzy.category}`,
    );

    try {
      await insertReading({
        time: new Date().toISOString(),
        acVoltage: voltage,
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

      emitNewReading({
        acVoltage: voltage,
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
        powerQualityScore: null,
        voltageStability: null,
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
