// apps/frontend/src/services/mqtt.ts
import { useEffect, useRef, useState } from "react";

export interface MqttSensorData {
  voltage: number;
  current: number;
  power: number;
  pf: number;
  apparentPower: number;
  energy: number;
  frequency: number;
  reactivePower: number;
  temperature: number;
  humidity: number;
  nodeId?: string;
}

type MqttCallback = (data: MqttSensorData) => void;

class MqttBridge {
  private ws: WebSocket | null = null;
  private subscribers = new Set<MqttCallback>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  connected = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/mqtt`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      // Subscribe to all node telemetry
      this.ws!.send(
        JSON.stringify({
          type: "subscribe",
          topic: "selene/+/telemetry",
          qos: 0,
        }),
      );
      // Keepalive ping every 30s
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        // EMQX WebSocket frame: { topic, payload, ... }
        const payload =
          typeof frame.payload === "string"
            ? JSON.parse(frame.payload)
            : frame.payload;

        if (payload && typeof payload.voltage === "number") {
          const data: MqttSensorData = {
            voltage: payload.voltage,
            current: payload.current,
            power: payload.power,
            pf: payload.pf,
            apparentPower: payload.apparentPower,
            energy: payload.energy,
            frequency: payload.frequency,
            reactivePower: payload.reactivePower,
            temperature: payload.temperature,
            humidity: payload.humidity,
            nodeId: frame.topic?.split("/")[1],
          };
          this.subscribers.forEach((fn) => fn(data));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      // Reconnect after 3 seconds
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe(fn: MqttCallback): () => void {
    this.subscribers.add(fn);
    if (this.subscribers.size === 1) {
      this.connect();
    }
    return () => {
      this.subscribers.delete(fn);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  disconnect() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}

const bridge = new MqttBridge();

export function useMqttLive() {
  const [data, setData] = useState<MqttSensorData | null>(null);
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef<MqttCallback>();

  callbackRef.current = (d: MqttSensorData) => {
    setData(d);
    setConnected(true);
  };

  useEffect(() => {
    const unsubscribe = bridge.subscribe((d) => {
      callbackRef.current?.(d);
    });
    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, []);

  return { data, connected } as const;
}
