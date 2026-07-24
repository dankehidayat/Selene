/**
 * Selene Ingestor Service (port 3005)
 *
 * MQTT → parser registry (energy / climate / future) → TimescaleDB
 * Standalone process; monolith may still run its own ingest during migration.
 */
import Fastify from "fastify";
import {
  SERVICE_PORTS,
  createMqttClient,
  createTimescaleClient,
  insertSensorReading,
  parseSeleneTopic,
} from "@selene/shared";
import {
  listSensorCatalog,
  runParserRegistry,
} from "@selene/sensors";

const port = Number(process.env.INGESTOR_PORT ?? SERVICE_PORTS.ingestor);
const app = Fastify({ logger: true });

const knownNodes = new Map<
  string,
  { nodeId: string; lastSeen: string; messageCount: number }
>();

function rememberNode(nodeId: string) {
  if (!nodeId || nodeId === "unknown" || nodeId === "+") return;
  const prev = knownNodes.get(nodeId);
  knownNodes.set(nodeId, {
    nodeId,
    lastSeen: new Date().toISOString(),
    messageCount: (prev?.messageCount ?? 0) + 1,
  });
}

let mqttConnected = false;

app.get("/health", async () => ({
  status: "ok",
  service: "ingestor",
  mqtt: mqttConnected,
  sensors: listSensorCatalog().map((s) => s.id),
  nodes: Array.from(knownNodes.values()),
}));

app.get("/api/ingest/status", async () => ({
  mqtt: mqttConnected,
  nodes: Array.from(knownNodes.values()),
  parsers: listSensorCatalog(),
}));

async function start() {
  const db = createTimescaleClient();
  // Ensure timescaledb extension / table exist is owned by monolith init for now;
  // ingestor only inserts.

  const { client, topic } = createMqttClient({
    clientId: `selene-ingestor-${Math.random().toString(16).slice(2, 8)}`,
  });

  client.on("connect", () => {
    mqttConnected = true;
    console.log(`[ingestor] MQTT connected, subscribe ${topic}`);
    client.subscribe(topic, { qos: 1 });
    console.log(
      `[ingestor] parsers: ${listSensorCatalog()
        .map((s) => s.id)
        .join(", ")}`,
    );
  });

  client.on("close", () => {
    mqttConnected = false;
  });

  client.on("error", (err) => {
    console.error("[ingestor] MQTT error:", err.message);
  });

  client.on("message", async (t, message) => {
    const parsed = parseSeleneTopic(t);
    const nodeId = parsed?.nodeId ?? "unknown";
    rememberNode(nodeId);

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      console.warn(`[ingestor] bad JSON from ${nodeId}`);
      return;
    }

    const { domains, flat, shouldDrop } = runParserRegistry(nodeId, payload);
    if (shouldDrop || domains.length === 0) return;

    try {
      await insertSensorReading(db, {
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
        tempComfort: flat.tempComfort,
        energyStatus: flat.energyStatus,
      });
      console.log(
        `[ingestor] ${nodeId} [${domains.join("+")}] V=${flat.acVoltage} P=${flat.acPower} T=${flat.temperature}`,
      );
    } catch (err) {
      console.error(`[ingestor] insert failed for ${nodeId}:`, err);
    }
  });

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[ingestor] HTTP :${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
