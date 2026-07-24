/** Extension service: gas (port 3009) — inactive until hardware + parser registered. */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.GAS_PORT ?? SERVICE_PORTS.gas);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "gas",
  extension: true,
  port,
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[gas] extension stub :${port}`);
