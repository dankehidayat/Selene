/** DHT11 / climate domain types */

export type TempComfort = "COLD" | "COOL" | "COMFORTABLE" | "WARM" | "HOT";

export interface ClimateReading {
  node_id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
}

export interface ClimateAnalyticsSummary {
  range: string;
  dataPoints: number;
  temperature: { average: number; min: number; max: number };
  humidity: { average: number; min: number; max: number };
  comfortDistribution?: Array<{ category: string; count: number }>;
}
