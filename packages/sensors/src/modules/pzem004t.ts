import {
  CAPABILITIES,
  SENSOR_MODULE_IDS,
  type FlatSensorReading,
  type Pzem004tSample,
  type TelemetryEnvelope,
} from "@selene/shared";
import { num, type JsonObject, type SensorModule } from "../types";

/**
 * Peacefair PZEM-004T v3 — AC energy monitor (UART on ESP32).
 * Legacy MQTT fields: voltage, current, power, pf, energy, frequency,
 * optional apparent_power / reactive_power.
 */
export function createPzem004tModule(): SensorModule {
  let sample: Pzem004tSample | null = null;

  return {
    id: SENSOR_MODULE_IDS.PZEM004T,
    displayName: "PZEM-004T",
    description:
      "AC single-phase energy meter: voltage, current, active power, PF, energy, frequency.",
    capabilities: [CAPABILITIES.ENERGY_AC],

    parseFromMqtt(payload: JsonObject) {
      const voltage = num(payload, "voltage", "ac_voltage", "acVoltage");
      const current = num(payload, "current", "ac_current", "acCurrent");
      const power = num(payload, "power", "ac_power", "acPower");
      const pf = num(payload, "pf", "cos_phi", "cosPhi", "power_factor");
      const energy = num(payload, "energy", "total_energy", "totalEnergy");
      const frequency = num(payload, "frequency");
      let apparentPower = num(
        payload,
        "apparent_power",
        "apparentPower",
      );
      let reactivePower = num(
        payload,
        "reactive_power",
        "reactivePower",
      );

      // Nested future shape: { pzem004t: { ... } } or { modules: { pzem004t } }
      const nested =
        (payload.pzem004t as JsonObject | undefined) ||
        ((payload.modules as JsonObject | undefined)?.pzem004t as
          | JsonObject
          | undefined);
      if (nested && typeof nested === "object") {
        return this.parseFromMqtt(nested);
      }

      const anyEnergy =
        voltage !== 0 || current !== 0 || power !== 0 || energy !== 0;
      if (!anyEnergy && !nested) {
        sample = null;
        return false;
      }

      if (apparentPower === 0 && pf > 0 && power > 0) {
        apparentPower = power / pf;
      }
      if (reactivePower === 0 && apparentPower > 0 && power >= 0) {
        const sq = apparentPower * apparentPower - power * power;
        reactivePower = sq > 0 ? Math.sqrt(sq) : 0;
      }

      sample = {
        voltage,
        current,
        power,
        energy,
        frequency,
        pf,
        apparentPower,
        reactivePower,
      };
      return true;
    },

    hasData: () => sample !== null,

    applyToEnvelope(envelope: TelemetryEnvelope) {
      if (!sample) return;
      envelope.modules.pzem004t = { ...sample };
      if (!envelope.present.includes(SENSOR_MODULE_IDS.PZEM004T)) {
        envelope.present.push(SENSOR_MODULE_IDS.PZEM004T);
      }
    },

    applyToFlat(row: FlatSensorReading) {
      if (!sample) return;
      row.acVoltage = sample.voltage;
      row.acCurrent = sample.current;
      row.acPower = sample.power;
      row.cosPhi = sample.pf;
      row.apparentPower = sample.apparentPower;
      row.totalEnergy = sample.energy;
      row.frequency = sample.frequency;
      row.reactivePower = sample.reactivePower;
    },
  };
}
