import type { SensorModuleId } from "./capabilities";

/** Climate comfort labels from fuzzy climate module. */
export type TempComfort = "COLD" | "COOL" | "COMFORTABLE" | "WARM" | "HOT";

/** Energy status codes stored in Timescale / shown on dashboard. */
export type EnergyStatusCode = "1" | "2" | "3"; // economical | normal | wasteful (legacy UI)

/** PZEM-004T electrical measurements (SI units as used by firmware). */
export interface Pzem004tSample {
  voltage: number; // V
  current: number; // A
  power: number; // W
  energy: number; // Wh (firmware cumulative)
  frequency: number; // Hz
  pf: number; // power factor 0–1
  apparentPower: number; // VA
  reactivePower: number; // VAR
}

/** DHT11 ambient climate (post-calibration on device). */
export interface Dht11Sample {
  temperature: number; // °C
  humidity: number; // %RH
}

/**
 * Canonical multi-sensor envelope (forward-looking).
 * New sensors add keys under `modules` without breaking old ones.
 */
export interface TelemetryEnvelope {
  schemaVersion: 1;
  nodeId: string;
  timestamp: string; // ISO-8601
  modules: {
    pzem004t?: Pzem004tSample;
    dht11?: Dht11Sample;
  };
  /** Which modules contributed to this sample */
  present: SensorModuleId[];
}

/**
 * Flat reading row used by Timescale + existing dashboard APIs.
 * Kept for backward compatibility; derived from TelemetryEnvelope.
 */
export interface FlatSensorReading {
  time: string;
  nodeId: string;
  acVoltage: number;
  acCurrent: number;
  acPower: number;
  cosPhi: number;
  apparentPower: number;
  totalEnergy: number;
  frequency: number;
  reactivePower: number;
  temperature: number;
  humidity: number;
  tempComfort?: string;
  energyStatus?: string;
}

/** OTA command payload published to selene/{nodeId}/command */
export interface OtaCommand {
  command: "ota";
  url: string;
  size: number;
}
