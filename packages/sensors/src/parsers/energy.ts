/**
 * Energy domain parser — PZEM-004T fields on legacy or nested MQTT payloads.
 */
import type { EnergyReading } from "@selene/shared";
import { createPzem004tModule } from "../modules/pzem004t";

export function canParseEnergy(payload: Record<string, unknown>): boolean {
  if (payload.pzem004t != null || (payload.modules as any)?.pzem004t != null) {
    return true;
  }
  return (
    payload.voltage !== undefined ||
    payload.ac_voltage !== undefined ||
    payload.power !== undefined ||
    payload.ac_power !== undefined ||
    payload.current !== undefined
  );
}

export function parseEnergyPayload(
  nodeId: string,
  payload: Record<string, unknown>,
  timestamp = new Date().toISOString(),
): EnergyReading {
  const mod = createPzem004tModule();
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
    voltage: row.acVoltage,
    current: row.acCurrent,
    power: row.acPower,
    energy: row.totalEnergy,
    frequency: row.frequency,
    pf: row.cosPhi,
    apparent_power: row.apparentPower,
    reactive_power: row.reactivePower,
  };
}
