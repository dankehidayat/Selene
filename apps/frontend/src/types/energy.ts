// Dashboard reading types — aligned with @selene/shared (modular sensors).
// Hardware today: PZEM-004T (energy) + DHT11 (climate).

export type TempComfort = "COLD" | "COOL" | "COMFORTABLE" | "WARM" | "HOT";

export interface EnergyReading {
  id?: string;
  timestamp: string; // ISO-8601
  /** PZEM-004T */
  acVoltage: number;
  acCurrent: number;
  acPower: number;
  cosPhi: number;
  apparentPower: number;
  totalEnergy: number; // Wh
  frequency: number;
  reactivePower: number;
  /** DHT11 (device may calibrate before publish) */
  temperature: number;
  humidity: number;
  tempComfort: TempComfort;
  energyStatus: "1" | "2" | "3"; // 1 economical, 2 normal, 3 wasteful
  powerQualityScore: number;
  voltageStability: number;
}

export interface HistoryPoint {
  timestamp: string;
  voltage: number;
  power: number;
  temperature: number;
  humidity: number;
}

export interface MonthlyUsagePoint {
  month: string;
  kwh: number;
}

export interface TemperaturePoint {
  hour: string;
  temp: number;
}

export interface PowerSeriesPoint {
  hour: string;
  voltage: number;
  current: number;
}

export interface PowerQuality {
  cosPhi: number;
  frequency: number;
  voltageStability: number;
  qualityScore: number;
}

export type ReadingStatusLabel = "Safe" | "Warning" | "Critical";

export const energyStatusLabel: Record<
  EnergyReading["energyStatus"],
  ReadingStatusLabel
> = {
  "1": "Safe",
  "2": "Warning",
  "3": "Critical",
};

/** Sensor modules this UI is designed around (catalog-driven later). */
export const FLEET_SENSOR_MODULES = [
  { id: "pzem004t", name: "PZEM-004T", domain: "energy" as const },
  { id: "dht11", name: "DHT11", domain: "climate" as const },
] as const;
