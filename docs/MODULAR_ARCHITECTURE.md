# Modular architecture (index)

The canonical design document is:

**[MODULAR_MICROSERVICES.md](./MODULAR_MICROSERVICES.md)**

It covers service ports, parser registry, database strategy, Caddy routing, Docker Compose, and the lux/soil extension playbooks.

### Quick status

| Piece | Location |
|-------|----------|
| Branch | `feat/api-v1-microservices` (merged to `master` as v1.0.0) |
| Shared types + DB/MQTT helpers | `packages/shared` |
| PZEM-004T + DHT11 parsers | `packages/sensors` |
| Standalone ingestor | `services/ingestor` |
| Implemented services | `services/auth` (:3009, full v1) · `services/analytics` (:3006) · `services/energy` (:3002) · `services/climate` (:3003) |
| Domain scaffolds | `services/firmware` |
| Extension stubs | `services/{soil,lux,gps,gas,generic}` |
| Gateway | `deploy/Caddyfile.modular` |
| Compose | `docker-compose.modular.yml` (VPS) / `docker-compose.yml` (alias) |
| Transition API | `apps/backend` :8787 (bridges `/api/v1/*` until services cut over) |
| ESP32 firmware | **[Eco-Office `feat/selene-mqtt-ota`](https://github.com/dankehidayat/Eco-Office/blob/feat/selene-mqtt-ota/Eco%20Office.ino)** — root `Eco Office.ino` (energy + environment); not stored in Selene |
