/** Extension service: soil (port 3006) — inactive until hardware + parser registered. */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.SOIL_PORT ?? SERVICE_PORTS.soil);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "soil",
  extension: true,
  port,
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[soil] extension stub :${port}`);
