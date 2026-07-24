// apps/backend/src/mqtt.ts — telemetry ingest via parser registry
import mqtt from "mqtt";
import {
  commandTopic,
  parseSeleneTopic,
  telemetryTopic,
} from "@selene/shared";
import {
  listSensorCatalog,
  runParserRegistry,
} from "@selene/sensors";
import { insertReading } from "./timescale";
import { classifyEnergyFuzzy, classifyClimateFuzzy } from "./analytics/fuzzy";
import { emitNewReading } from "./events";
import { evaluateSensorAlerts } from "./alerts";

const MQTT_HOST = process.env.MQTT_HOST || "localhost";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "1883");
const TOPIC = process.env.MQTT_TOPIC || telemetryTopic("+");
const MQTT_USER = process.env.MQTT_USER || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

let client: mqtt.MqttClient | null = null;

const knownNodes = new Map<
  string,
  { nodeId: string; lastSeen: string; messageCount: number }
>();

export function rememberNode(nodeId: string) {
  if (!nodeId || nodeId === "unknown" || nodeId === "+") return;
  const prev = knownNodes.get(nodeId);
  knownNodes.set(nodeId, {
    nodeId,
    lastSeen: new Date().toISOString(),
    messageCount: (prev?.messageCount ?? 0) + 1,
  });
}

export function getKnownNodes() {
  return Array.from(knownNodes.values()).sort((a, b) =>
    a.lastSeen < b.lastSeen ? 1 : -1,
  );
}

export function getMqttConnectionStatus() {
  return {
    connected: Boolean(client?.connected),
    broker: `${MQTT_HOST}:${MQTT_PORT}`,
    topic: TOPIC,
    clientId: client?.options?.clientId
      ? String(client.options.clientId)
      : null,
  };
}

export function getSensorCatalog() {
  return listSensorCatalog();
}

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
        console.log(
          `[MQTT] Sensor modules: ${listSensorCatalog()
            .map((s) => s.id)
            .join(", ")}`,
        );
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
    const parsedTopic = parseSeleneTopic(topic);
    const nodeId = parsedTopic?.nodeId ?? "unknown";
    rememberNode(nodeId);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(message.toString());
    } catch (err) {
      console.warn(`[MQTT] Invalid JSON from node "${nodeId}":`, err);
      return;
    }

    // Parser registry: energy (PZEM) + climate (DHT11) may both fire
    const { domains, flat, shouldDrop } = runParserRegistry(nodeId, payload);

    if (shouldDrop || domains.length === 0) {
      return;
    }

    const energyFuzzy = classifyEnergyFuzzy(
      flat.acVoltage,
      flat.acPower,
      flat.cosPhi,
      flat.reactivePower,
    );
    const climateFuzzy = classifyClimateFuzzy(
      flat.temperature,
      flat.humidity,
    );

    const energyStatus =
      energyFuzzy.category === "ECONOMICAL"
        ? "1"
        : energyFuzzy.category === "NORMAL"
          ? "2"
          : "3";

    flat.tempComfort = climateFuzzy.category;
    flat.energyStatus = energyStatus;

    console.log(
      `[MQTT] ${nodeId} [${domains.join("+")}] | V:${flat.acVoltage.toFixed(1)}V P:${flat.acPower.toFixed(1)}W ` +
        `T:${flat.temperature.toFixed(1)}°C H:${flat.humidity.toFixed(0)}% ` +
        `Energy:${energyFuzzy.category} Climate:${climateFuzzy.category}`,
    );

    try {
      await insertReading({
        time: flat.time,
        acVoltage: flat.acVoltage,
        acCurrent: flat.acCurrent,
        acPower: flat.acPower,
        cosPhi: flat.cosPhi,
        apparentPower: flat.apparentPower,
        totalEnergy: flat.totalEnergy,
        frequency: flat.frequency,
        reactivePower: flat.reactivePower,
        temperature: flat.temperature,
        humidity: flat.humidity,
        tempComfort: climateFuzzy.category,
        energyStatus,
      });

      emitNewReading({
        acVoltage: flat.acVoltage,
        acCurrent: flat.acCurrent,
        acPower: flat.acPower,
        cosPhi: flat.cosPhi,
        apparentPower: flat.apparentPower,
        totalEnergy: flat.totalEnergy,
        frequency: flat.frequency,
        reactivePower: flat.reactivePower,
        temperature: flat.temperature,
        humidity: flat.humidity,
        tempComfort: climateFuzzy.category,
        energyStatus,
        powerQualityScore: null,
        voltageStability: null,
      });

      // Non-blocking sensor alerts (energy / climate notifications)
      void evaluateSensorAlerts({
        nodeId,
        acPower: flat.acPower,
        cosPhi: flat.cosPhi,
        temperature: flat.temperature,
        humidity: flat.humidity,
        energyCategory: energyFuzzy.category,
        climateCategory: climateFuzzy.category,
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

export function sendOtaCommand(
  nodeId: string,
  downloadUrl: string,
  fileSize: number,
) {
  if (!client?.connected) {
    console.warn("[MQTT] Cannot send OTA command — not connected");
    return false;
  }

  const topic = commandTopic(nodeId);
  const payload = JSON.stringify({
    command: "ota",
    url: downloadUrl,
    size: fileSize,
  });

  client.publish(topic, payload, { qos: 1 });
  console.log(`[MQTT] OTA command sent to ${topic}: ${fileSize} bytes`);
  return true;
}
