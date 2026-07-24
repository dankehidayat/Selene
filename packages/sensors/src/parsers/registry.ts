/**
 * Ingestor parser registry — architecture doc § Ingestor Parser Registry Pattern.
 *
 * Multiple parsers may fire on a single ESP32 payload (energy + climate).
 * For the current schema, partials are merged into one flat Timescale row.
 * Extension parsers (lux, soil, …) will use dedicated hypertables later.
 */
import type {
  ClimateReading,
  EnergyReading,
  FlatSensorReading,
} from "@selene/shared";
import { canParseClimate, parseClimatePayload } from "./climate";
import { canParseEnergy, parseEnergyPayload } from "./energy";

export type DomainParserId = "energy" | "climate" | "lux" | "soil" | "gps" | "gas" | "generic";

export interface DomainParseResult {
  domain: DomainParserId;
  energy?: EnergyReading;
  climate?: ClimateReading;
}

export interface ParserEntry {
  id: DomainParserId;
  detect: (payload: Record<string, unknown>) => boolean;
  parse: (
    nodeId: string,
    payload: Record<string, unknown>,
    timestamp?: string,
  ) => DomainParseResult;
}

export const parserRegistry: ParserEntry[] = [
  {
    id: "energy",
    detect: canParseEnergy,
    parse: (nodeId, payload, ts) => ({
      domain: "energy",
      energy: parseEnergyPayload(nodeId, payload, ts),
    }),
  },
  {
    id: "climate",
    detect: canParseClimate,
    parse: (nodeId, payload, ts) => ({
      domain: "climate",
      climate: parseClimatePayload(nodeId, payload, ts),
    }),
  },
  // Extension parsers — register when hardware ships:
  // { id: "lux", detect: canParseLux, parse: ... },
  // { id: "soil", detect: canParseSoil, parse: ... },
];

export function runParserRegistry(
  nodeId: string,
  payload: Record<string, unknown>,
  timestamp = new Date().toISOString(),
): {
  domains: DomainParserId[];
  energy?: EnergyReading;
  climate?: ClimateReading;
  flat: FlatSensorReading;
  shouldDrop: boolean;
} {
  let energy: EnergyReading | undefined;
  let climate: ClimateReading | undefined;
  const domains: DomainParserId[] = [];

  for (const entry of parserRegistry) {
    if (!entry.detect(payload)) continue;
    const result = entry.parse(nodeId, payload, timestamp);
    domains.push(entry.id);
    if (result.energy) energy = result.energy;
    if (result.climate) climate = result.climate;
  }

  const flat: FlatSensorReading = {
    time: timestamp,
    nodeId,
    acVoltage: energy?.voltage ?? 0,
    acCurrent: energy?.current ?? 0,
    acPower: energy?.power ?? 0,
    cosPhi: energy?.pf ?? 0,
    apparentPower: energy?.apparent_power ?? 0,
    totalEnergy: energy?.energy ?? 0,
    frequency: energy?.frequency ?? 0,
    reactivePower: energy?.reactive_power ?? 0,
    temperature: climate?.temperature ?? 0,
    humidity: climate?.humidity ?? 0,
  };

  // Legacy gate: ignore dead electrical bus with no power (noise frames)
  const shouldDrop = flat.acVoltage < 100 && flat.acPower === 0;

  return { domains, energy, climate, flat, shouldDrop };
}
