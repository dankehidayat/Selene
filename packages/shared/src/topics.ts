/** MQTT topic conventions for the Selene fleet. */
export const MQTT_NAMESPACE = "selene";

export function telemetryTopic(nodeId = "+") {
  return `${MQTT_NAMESPACE}/${nodeId}/telemetry`;
}

export function commandTopic(nodeId: string) {
  return `${MQTT_NAMESPACE}/${nodeId}/command`;
}

export function statusTopic(nodeId = "+") {
  return `${MQTT_NAMESPACE}/${nodeId}/status`;
}

/**
 * Parse `selene/{nodeId}/{kind}` topics.
 * Returns null if the topic does not match the namespace.
 */
export function parseSeleneTopic(topic: string): {
  nodeId: string;
  kind: string;
} | null {
  const parts = topic.split("/");
  if (parts.length < 3 || parts[0] !== MQTT_NAMESPACE) return null;
  return { nodeId: parts[1], kind: parts.slice(2).join("/") };
}
