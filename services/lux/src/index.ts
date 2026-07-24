/** Extension service: lux (port 3007) — inactive until hardware + parser registered. */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.LUX_PORT ?? SERVICE_PORTS.lux);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "lux",
  extension: true,
  port,
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[lux] extension stub :${port}`);
