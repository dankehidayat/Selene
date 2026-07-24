import {
  DEFAULT_SENSOR_MODULES,
  type SensorModuleId,
  type TelemetryEnvelope,
  type FlatSensorReading,
} from "@selene/shared";
import { createDht11Module } from "./modules/dht11";
import { createPzem004tModule } from "./modules/pzem004t";
import type { JsonObject, SensorModule } from "./types";

/** Factory map — register future sensors here (SCD40, BME280, …). */
const factories: Record<SensorModuleId, () => SensorModule> = {
  pzem004t: createPzem004tModule,
  dht11: createDht11Module,
};

export function listRegisteredSensorIds(): SensorModuleId[] {
  return Object.keys(factories) as SensorModuleId[];
}

export function createSensorModule(id: SensorModuleId): SensorModule {
  const factory = factories[id];
  if (!factory) {
    throw new Error(`Unknown sensor module: ${id}`);
  }
  return factory();
}

/** Default fleet profile: PZEM-004T + DHT11 (current hardware). */
export function createDefaultSensorStack(): SensorModule[] {
  return DEFAULT_SENSOR_MODULES.map((id) => createSensorModule(id));
}

export function listSensorCatalog(): Array<{
  id: SensorModuleId;
  displayName: string;
  description: string;
  capabilities: string[];
}> {
  return listRegisteredSensorIds().map((id) => {
    const m = createSensorModule(id);
    return {
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      capabilities: [...m.capabilities],
    };
  });
}

export interface ParseTelemetryResult {
  envelope: TelemetryEnvelope;
  flat: FlatSensorReading;
  /** True when PZEM reports dead bus (legacy gate: V&lt;100 and P=0) */
  shouldDrop: boolean;
}

/**
 * Parse a legacy or modular MQTT JSON payload into canonical + flat forms.
 * Stateless: creates a fresh sensor stack per message.
 */
export function parseTelemetryPayload(
  nodeId: string,
  payload: JsonObject,
  timestamp = new Date().toISOString(),
): ParseTelemetryResult {
  const modules = createDefaultSensorStack();
  const envelope: TelemetryEnvelope = {
    schemaVersion: 1,
    nodeId,
    timestamp,
    modules: {},
    present: [],
  };
  const flat: FlatSensorReading = {
    time: timestamp,
    nodeId,
    acVoltage: 0,
    acCurrent: 0,
    acPower: 0,
    cosPhi: 0,
    apparentPower: 0,
    totalEnergy: 0,
    frequency: 0,
    reactivePower: 0,
    temperature: 0,
    humidity: 0,
  };

  for (const mod of modules) {
    if (mod.parseFromMqtt(payload)) {
      mod.applyToEnvelope(envelope);
      mod.applyToFlat(flat);
    }
  }

  // Preserve legacy ingest filter used on the current firmware stream
  const shouldDrop = flat.acVoltage < 100 && flat.acPower === 0;

  return { envelope, flat, shouldDrop };
}
