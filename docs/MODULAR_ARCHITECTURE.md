# Modular architecture (index)

The canonical design document is:

**[MODULAR_MICROSERVICES.md](./MODULAR_MICROSERVICES.md)**

It covers service ports, parser registry, database strategy, Caddy routing, Docker Compose, and the lux/soil extension playbooks.

### Quick status

| Piece | Location |
|-------|----------|
| Branch | `feat/modular-microservices` |
| Shared types + DB/MQTT helpers | `packages/shared` |
| PZEM-004T + DHT11 parsers | `packages/sensors` |
| Standalone ingestor | `services/ingestor` |
| Domain scaffolds | `services/{auth,energy,climate,firmware}` |
| Extension stubs | `services/{soil,lux,gps,gas,generic}` |
| Gateway | `deploy/Caddyfile.modular` |
| Compose | `docker-compose.modular.yml` |
| Transition API | `apps/backend` :8787 |
