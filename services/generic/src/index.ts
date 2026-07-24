/** Extension service: generic (port 3010) — inactive until hardware + parser registered. */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.GENERIC_PORT ?? SERVICE_PORTS.generic);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "generic",
  extension: true,
  port,
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[generic] extension stub :${port}`);
