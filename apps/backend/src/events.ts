// apps/backend/src/events.ts
type SSECallback = (data: any) => void;

const listeners: SSECallback[] = [];

export function onNewReading(cb: SSECallback) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function emitNewReading(data: any) {
  for (const cb of listeners) {
    try {
      cb(data);
    } catch {
      // Listener disconnected — will be cleaned up on next emit
    }
  }
}
