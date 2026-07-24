# Energy_Monitor (ESP32 DevKit V1) + Selene OTA

Full sketch with MQTT telemetry **and** OTA command handling.

## What was added vs your previous sketch

- Subscribes to `selene/office-main/command` (already did)
- Handles `command: "ota"` with HTTPS download via `HTTPUpdate`
- Reports result to `POST /api/firmware/result`
- Larger MQTT buffer for long OTA URLs

## Arduino IDE settings (ESP32 DevKit V1)

| Setting | Value |
|---------|--------|
| Board | **ESP32 Dev Module** (or DOIT ESP32 DEVKIT V1) |
| Upload Speed | 921600 (or 115200 if unstable) |
| Flash Size | **4MB** (typical DevKit V1) |
| **Partition Scheme** | **Default 4MB with spiffs** (or any scheme **with OTA**) |
| Port | your USB serial port |

> Without an OTA-capable partition scheme, `HTTPUpdate` will fail even if MQTT works.

## Libraries

Install via Library Manager if missing:

- Blynk
- LiquidCrystal I2C (or LiquidCrystal_I2C)
- WiFiManager (tzapu)
- PZEM004Tv30
- DHT sensor library (Adafruit) + Adafruit Unified Sensor
- PubSubClient
- ArduinoJson (v6)

`HTTPUpdate` / `WiFiClientSecure` ship with the ESP32 core.

## First flash (USB) — required once

1. Open `Energy_Monitor.ino` in Arduino IDE.
2. Select board + partition scheme above.
3. **Upload via USB** (this installs the OTA-capable firmware).
4. Open **Serial Monitor @ 115200**.
5. Confirm:
   - `WiFi Connected!`
   - `MQTT: ... berhasil!`
   - `MQTT: Subscribe ke selene/office-main/command`

## Then use Selene Admin OTA

1. Export binary: **Sketch → Export compiled Binary** (optional for next OTA).
2. Selene → **Admin Tools → Firmware**.
3. Target: `office-main`, upload `Energy_Monitor.ino.bin`.
4. Serial should show:
   ```text
   MQTT: Perintah diterima [...]: {"command":"ota",...}
   MQTT: OTA scheduled
   OTA: starting HTTPS firmware update
   OTA: SUCCESS — rebooting
   ```
5. Dashboard OTA log / history may show downloading → success.

## Security note

`client.setInsecure()` skips TLS certificate verification (fine for first bring-up). For production, embed a CA cert and use `setCACert()`.
