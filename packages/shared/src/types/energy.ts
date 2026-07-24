/** PZEM-004T / energy domain types */

export interface EnergyReading {
  node_id: string;
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  pf: number;
  apparent_power: number;
  reactive_power: number;
}

export interface EnergyAnalyticsSummary {
  range: string;
  dataPoints: number;
  power: { average: number; min: number; max: number };
  voltage: { average: number };
  powerFactor: { average: number };
}
