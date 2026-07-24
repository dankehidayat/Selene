/** Default service ports (modular microservices target). */
export const SERVICE_PORTS = {
  auth: 3001,
  energy: 3002,
  climate: 3003,
  firmware: 3004,
  ingestor: 3005,
  soil: 3006,
  lux: 3007,
  gps: 3008,
  gas: 3009,
  generic: 3010,
  /** Transition monolith */
  monolith: 8787,
  frontendDev: 5173,
  frontendPreview: 4173,
} as const;

export type ServiceName = keyof typeof SERVICE_PORTS;
