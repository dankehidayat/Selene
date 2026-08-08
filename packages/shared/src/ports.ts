/** Default service ports (modular microservices target). */
export const SERVICE_PORTS = {
  auth: 3009,
  energy: 3002,
  climate: 3003,
  firmware: 3004,
  ingestor: 3005,
  analytics: 3006,
  /** Transition monolith */
  monolith: 8787,
  frontendDev: 5173,
  frontendPreview: 4173,
} as const;

export type ServiceName = keyof typeof SERVICE_PORTS;
