/**
 * Climate domain parser — DHT11 fields on legacy or nested MQTT payloads.
 */
import type { ClimateReading } from "@selene/shared";
import { createDht11Module } from "../modules/dht11";

export function canParseClimate(payload: Record<string, unknown>): boolean {
  if (payload.dht11 != null || (payload.modules as any)?.dht11 != null) {
    return true;
  }
  return (
    payload.temperature !== undefined ||
    payload.temp !== undefined ||
    payload.humidity !== undefined ||
    payload.hum !== undefined ||
    payload.rh !== undefined
  );
}

export function parseClimatePayload(
  nodeId: string,
  payload: Record<string, unknown>,
  timestamp = new Date().toISOString(),
): ClimateReading {
  const mod = createDht11Module();
  mod.parseFromMqtt(payload);
  const row = {
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
  mod.applyToFlat(row);

  return {
    node_id: nodeId,
    timestamp,
    temperature: row.temperature,
    humidity: row.humidity,
  };
}
