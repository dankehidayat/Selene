import {
  CAPABILITIES,
  SENSOR_MODULE_IDS,
  type Dht11Sample,
  type FlatSensorReading,
  type TelemetryEnvelope,
} from "@selene/shared";
import { num, type JsonObject, type SensorModule } from "../types";

/**
 * Aosong DHT11 — low-cost temperature / humidity.
 * Device firmware may apply calibration before MQTT publish.
 * Legacy fields: temperature, humidity.
 */
export function createDht11Module(): SensorModule {
  let sample: Dht11Sample | null = null;

  return {
    id: SENSOR_MODULE_IDS.DHT11,
    displayName: "DHT11",
    description:
      "Digital temperature and relative humidity sensor (calibrated on node when configured).",
    capabilities: [CAPABILITIES.CLIMATE],

    parseFromMqtt(payload: JsonObject) {
      const nested =
        (payload.dht11 as JsonObject | undefined) ||
        ((payload.modules as JsonObject | undefined)?.dht11 as
          | JsonObject
          | undefined);
      if (nested && typeof nested === "object") {
        return this.parseFromMqtt(nested);
      }

      const temperature = num(payload, "temperature", "temp");
      const humidity = num(payload, "humidity", "hum", "rh");

      // DHT11 alone may publish zeros during fault; still accept if keys exist
      const hasKeys =
        "temperature" in payload ||
        "temp" in payload ||
        "humidity" in payload ||
        "hum" in payload ||
        "rh" in payload;

      if (!hasKeys && temperature === 0 && humidity === 0) {
        sample = null;
        return false;
      }

      sample = { temperature, humidity };
      return true;
    },

    hasData: () => sample !== null,

    applyToEnvelope(envelope: TelemetryEnvelope) {
      if (!sample) return;
      envelope.modules.dht11 = { ...sample };
      if (!envelope.present.includes(SENSOR_MODULE_IDS.DHT11)) {
        envelope.present.push(SENSOR_MODULE_IDS.DHT11);
      }
    },

    applyToFlat(row: FlatSensorReading) {
      if (!sample) return;
      row.temperature = sample.temperature;
      row.humidity = sample.humidity;
    },
  };
}
