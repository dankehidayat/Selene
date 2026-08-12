# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Danke Hidayat (owner/developer):** monitors the single-node sensor fleet (office-main) day-to-day on a smartphone; acts on readings and investigates anomalies.
- **IPB University final defense committee:** evaluates the working IoT pipeline, analytics engine, and presentation as a final project.
- **Portfolio visitors / recruiters:** assess the quality of engineering, design, and domain analysis.

The same dashboard serves all three audiences without separate views.

## Product Purpose

Turn live ESP32 sensor telemetry into statistical and fuzzy-logic insight about energy consumption and thermal comfort. Success means a working end-to-end pipeline, defensible analytics (ASHRAE 55 / SNI 03-6572 fuzzy classification), and a presentation that is coherent enough for a final project defense or a portfolio visit.

## Positioning

Selene is equally two things:

1. **An end-to-end IoT pipeline:** ESP32 (PZEM-004T + DHT11) → MQTT (EMQX) → TimescaleDB → live dashboard with SSE.
2. **A domain intelligence engine:** 15-rule Mamdani fuzzy logic for energy efficiency (ECONOMICAL / NORMAL / WASTEFUL) and 14-rule climate comfort model based on ASHRAE 55-2020 and SNI 03-6572 (COLD / COOL / COMFORTABLE / WARM / HOT), with Bland-Altman, box plots, decision surfaces, and ensemble forecasting.

Neither alone is the product; both together distinguish it from a generic chart dashboard.

## Operating Context

- **Single monitored node:** `office-main`, ESP32 with PZEM-004T (energy) + DHT11 (climate), publish interval ~30 s. No multi-node fleet yet.
- **Broker:** EMQX 5.7 container, port 1883 public, built-in database auth, dashboard at `emqx.dankehidayat.my.id`.
- **Historical data:** restored from Google Sheets (Oct 2025 → present, exported as CSV) and persisted in a TimescaleDB hypertable with continuous aggregates (5 m, 1 h).
- **Electricity tariff:** PLN Rp 1.444,7 / kWh (official Indonesian state utility rate).
- **Timezone / locale:** WIB (UTC+7), `id-ID` date/time formatting.
- **Deployment:** single VPS, Docker Compose (`docker-compose.modular.yml`), Caddy reverse proxy, `selene.dankehidayat.my.id`.
- **Maintainer:** a single developer (you); runbooks exist in `docs/02–DEPLOYMENT` through `docs/07–CREDENTIAL-ROTATION`.

## Capabilities and Constraints

### Live monitoring
- SSE stream of latest sensor reading (voltage, current, power, cos-phi, total energy, reactive power, frequency, temperature, humidity, comfort status, energy status, power quality, voltage stability).
- StatCard tiles (Voltage, Current, Power, Est. Cost), Power Overview card (cos-phi, frequency, quality score), Climate Overview card.

### Analytics
- **Energy tab:** composed line chart (power, current, apparent, reactive + forecast), peak-hours bar chart, energy-consumption area chart, key metrics (avg power, total energy, est. cost, data points, power min/max, peak hour, std deviation).
- **Environment tab:** temperature/humidity line chart, dew point, correlation, comfort distribution bar, hourly averages.
- **Energy Fuzzy tab:** distribution donut, power-vs-PF scatter, decision surface (grid + actual), box plot by category, Bland-Altman, voltage/power membership function curves.
- **Climate Fuzzy tab:** distribution donut, temperature-vs-humidity scatter.
- **Data Log:** server-side paginated table (all columns), CSV / TSV export (all or by date range).
- All analytics accept a time range filter (from/to date + time).

### Auth & admin
- Register, login (email + password), 2FA TOTP, password reset via Resend email.
- Roles: USER / ADMIN. Admin tools: user list, role management (admin can promote/demote others), toggle active, delete user, stats.

### Extensibility
- Parser registry architecture in `packages/sensors` — new sensor types can be added by writing a parser and registering it. `services/` scaffold exists for microservice cutover.

### Constraints
- **Smartphone is a primary device.** Mobile performance, touch targets, and viewport adaptation are product requirements, not nice-to-haves.
- **Indonesian context.** Tariff, timezone, locale, and standards must display correctly.
- **Real data only.** The Google Sheets history (Oct 2025 → April 2026 gap → July 2025 → present) is ground truth. No fabricated readings, users, or testimonials.
- **Solo maintainer.** Runbooks, CI, and simple infrastructure are mandatory; complexity without documentation is not acceptable.
- **TimescaleDB continuous aggregates.** Analytics queries are powered by 5 m / 1 h caggs; freshness and consistency matter.

## Brand Commitments

- **Name:** Selene (Greek moon goddess — "the moon watches overnight; Selene keeps the lights honest").
- **Logo:** `SeleneMark` SVG (moon crescent + data symbol), rendered in the sidebar and `/assets/`; embed in metadata/social preview.
- **Voice:** direct, technical but not jargon-heavy. Greeting taglines rotate through a deck of ~30 lines — all descriptive, calm, data-aware ("Insights first, deep analytics when you're ready.").
- **Identity:** the product is a dashboard for informed operational decisions, not a smart-home consumer appliance. Tone respects the user as an engineer or building manager.

## Evidence on Hand

- Live deployment at `selene.dankehidayat.my.id` with real telemetry.
- Google Sheets history (12 295 rows, Oct 2025 → Apr 2026 + Jul 2025 → present); exported CSV informs restoration and analysis.
- Edge firmware in the separate `dankehidayat/Eco-Office` repository (ESP32 Arduino sketch).
- Sensor-ingestor and backend both connect to EMQX with the same credentials that the device uses.
- Full fuzzy-logic membership function and rule definitions in `@selene/shared/analytics/fuzzy.ts`.
- Design system tokens inferred from `tailwind.config.js` and `index.css`.

## Product Principles

1. **Mobile-first clarity.** The default viewport is a phone. Layouts, touch targets, chart legends, and data density must work there first.
2. **Real data, real context.** Units, tariff rates, locale formatting, and comfort standards are not decorative — they must match the user's real world (Indonesia, PLN, WIB, ASHRAE/SNI).
3. **Insight over decoration.** Every chart, pill, card, and number gives the reader something they did not already know. If a visual does not carry information, it should not be there.
4. **Live by default.** The dashboard renders fresh data — SSE for the latest, 30 s polling ranges, immediate aggregate refresh after data import. Stale state is an error state.
5. **Solo-maintainer operability.** Documentation, runbooks, and simple tooling outrank elaborate CI or microservice scaffolding that a solo developer cannot maintain.