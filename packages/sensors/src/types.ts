import type {
  CapabilityId,
  FlatSensorReading,
  SensorModuleId,
  TelemetryEnvelope,
} from "@selene/shared";

/**
 * Pluggable sensor module contract.
 * Each physical sensor (PZEM-004T, DHT11, future SCD40, …) implements this.
 */
export interface SensorModule {
  id: SensorModuleId;
  displayName: string;
  /** Human description for glossary / admin UI */
  description: string;
  capabilities: CapabilityId[];
  /**
   * Extract this module's slice from a raw MQTT JSON object.
   * Supports both legacy flat firmware payloads and future nested shapes.
   */
  parseFromMqtt(payload: Record<string, unknown>): boolean;
  /** Whether this module contributed data on the last parse */
  hasData(): boolean;
  /** Merge module fields into a growing envelope */
  applyToEnvelope(envelope: TelemetryEnvelope): void;
  /** Merge into flat Timescale row (backward compatible store) */
  applyToFlat(row: FlatSensorReading): void;
}

export type JsonObject = Record<string, unknown>;

export function num(payload: JsonObject, ...keys: string[]): number {
  for (const k of keys) {
    const v = payload[k];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}
