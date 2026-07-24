import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import { telemetryTopic } from "./topics";

export interface MqttFactoryOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  clientId?: string;
  topic?: string;
}

export function createMqttClient(opts: MqttFactoryOptions = {}): {
  client: MqttClient;
  topic: string;
} {
  const host = opts.host ?? process.env.MQTT_HOST ?? "localhost";
  const port = opts.port ?? parseInt(process.env.MQTT_PORT || "1883", 10);
  const username = opts.username ?? process.env.MQTT_USER ?? "";
  const password = opts.password ?? process.env.MQTT_PASSWORD ?? "";
  const topic = opts.topic ?? process.env.MQTT_TOPIC ?? telemetryTopic("+");

  const options: IClientOptions = {
    host,
    port,
    clientId:
      opts.clientId ??
      `selene-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  };

  if (username && password) {
    options.username = username;
    options.password = password;
  }

  return { client: mqtt.connect(options), topic };
}
