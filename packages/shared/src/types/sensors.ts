/**
 * Extension sensor types (inactive until hardware + services exist).
 * Fielded hardware today: PZEM-004T + DHT11 only.
 */

export interface LuxReading {
  node_id: string;
  illuminance: number;
  timestamp: string;
}

export interface SoilReading {
  node_id: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  temperature: number;
  humidity: number;
  ec: number;
  timestamp: string;
}

export interface GpsReading {
  node_id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  timestamp: string;
}

export interface GasReading {
  node_id: string;
  gas_type: string;
  concentration_ppm: number;
  timestamp: string;
}

export interface GenericReading {
  node_id: string;
  metric_name: string;
  metric_value: number;
  unit: string;
  timestamp: string;
}
