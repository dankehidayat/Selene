-- =============================================================================
-- Sensor Readings Table Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
    time            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    node_id         TEXT              NOT NULL DEFAULT 'office-main',
    ac_voltage      NUMERIC           DEFAULT 0,
    ac_current      NUMERIC           DEFAULT 0,
    ac_power        NUMERIC           DEFAULT 0,
    cos_phi         NUMERIC           DEFAULT 0,
    apparent_power  NUMERIC           DEFAULT 0,
    total_energy    NUMERIC           DEFAULT 0,
    frequency       NUMERIC           DEFAULT 50,
    reactive_power  NUMERIC           DEFAULT 0,
    temperature     NUMERIC           DEFAULT 25,
    humidity        NUMERIC           DEFAULT 60,
    temp_comfort    TEXT              DEFAULT 'COMFORTABLE',
    energy_status   TEXT              DEFAULT 'NORMAL',
    current_per_kw  NUMERIC           DEFAULT 0,
    power_quality_score NUMERIC       DEFAULT 40,
    energy_cost     NUMERIC           DEFAULT 0,
    voltage_stability NUMERIC         DEFAULT 100
);

SELECT create_hypertable('sensor_readings', 'time');

CREATE INDEX IF NOT EXISTS idx_sensor_readings_node_time 
  ON sensor_readings (node_id DESC, time DESC);

GRANT SELECT ON sensor_readings TO timescaledb_monitor;
