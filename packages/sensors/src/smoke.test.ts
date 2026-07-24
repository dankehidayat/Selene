/**
 * Smoke: parser registry (energy + climate) + catalog.
 * bun run packages/sensors/src/smoke.test.ts
 */
import {
  listSensorCatalog,
  runParserRegistry,
  canParseEnergy,
  canParseClimate,
  parserRegistry,
} from "./index";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(parserRegistry.length >= 2, "registry has energy + climate");
assert(listSensorCatalog().map((c) => c.id).sort().join() === "dht11,pzem004t", "catalog");

const payload = {
  voltage: 220,
  current: 0.4,
  power: 80,
  pf: 0.92,
  energy: 10,
  frequency: 50,
  temperature: 27.5,
  humidity: 58,
};

assert(canParseEnergy(payload) && canParseClimate(payload), "both detect");

const r = runParserRegistry("office-main", payload);
assert(!r.shouldDrop, "not dropped");
assert(r.domains.includes("energy") && r.domains.includes("climate"), "both domains");
assert(r.flat.acVoltage === 220 && r.flat.temperature === 27.5, "merged flat");
assert(r.energy?.power === 80 && r.climate?.humidity === 58, "domain objects");

console.log("OK — registry:", parserRegistry.map((p) => p.id).join(", "));
console.log("OK — domains on sample:", r.domains.join("+"));
