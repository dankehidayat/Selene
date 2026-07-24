/** Extension service: gps (port 3008) — inactive until hardware + parser registered. */
import Fastify from "fastify";
import { SERVICE_PORTS } from "@selene/shared";

const port = Number(process.env.GPS_PORT ?? SERVICE_PORTS.gps);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  status: "ok",
  service: "gps",
  extension: true,
  port,
}));

await app.listen({ port, host: "0.0.0.0" });
console.log(`[gps] extension stub :${port}`);
