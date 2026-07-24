export type { SensorModule, JsonObject } from "./types";
export { num } from "./types";
export { createPzem004tModule } from "./modules/pzem004t";
export { createDht11Module } from "./modules/dht11";
export {
  createDefaultSensorStack,
  createSensorModule,
  listRegisteredSensorIds,
  listSensorCatalog,
  parseTelemetryPayload,
  type ParseTelemetryResult,
} from "./registry";

export { canParseEnergy, parseEnergyPayload } from "./parsers/energy";
export { canParseClimate, parseClimatePayload } from "./parsers/climate";
export {
  parserRegistry,
  runParserRegistry,
  type ParserEntry,
  type DomainParserId,
  type DomainParseResult,
} from "./parsers/registry";
