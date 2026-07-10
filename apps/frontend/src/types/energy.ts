// [apps/frontend] src/types/energy.ts
export interface EnergyReading {
  id?: string;
  timestamp: string; // ISO-8601
  acVoltage: number;
  acCurrent: number;
  acPower: number;
  cosPhi: number;
  apparentPower: number;
  totalEnergy: number; // Wh
  frequency: number;
  reactivePower: number;
  temperature: number; // DHT12
  humidity: number; // DHT12
  tempComfort: "COLD" | "COOL" | "COMFORTABLE" | "WARM" | "HOT";
  energyStatus: "1" | "2" | "3"; // 1 = safe, 2 = warning, 3 = critical
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
