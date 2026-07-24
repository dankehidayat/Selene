/**
 * Capability IDs describe what a node or sensor can measure.
 * UI, analytics, and OTA should key off capabilities — not hard-coded SKUs.
 */
export const CAPABILITIES = {
  ENERGY_AC: "energy.ac",
  CLIMATE: "climate.ambient",
  OTA: "device.ota",
} as const;

export type CapabilityId = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Hardware modules currently fielded on Selene nodes. */
export const SENSOR_MODULE_IDS = {
  PZEM004T: "pzem004t",
  DHT11: "dht11",
} as const;

export type SensorModuleId =
  (typeof SENSOR_MODULE_IDS)[keyof typeof SENSOR_MODULE_IDS];

/** Default node profile: office ESP32 with PZEM + DHT11. */
export const DEFAULT_NODE_CAPABILITIES: CapabilityId[] = [
  CAPABILITIES.ENERGY_AC,
  CAPABILITIES.CLIMATE,
  CAPABILITIES.OTA,
];

export const DEFAULT_SENSOR_MODULES: SensorModuleId[] = [
  SENSOR_MODULE_IDS.PZEM004T,
  SENSOR_MODULE_IDS.DHT11,
];
