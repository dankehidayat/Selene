// apps/frontend/src/lib/formatNotification.tsx
import type { ReactNode } from "react";

/** Render notification body; **text** becomes bold (node names). */
export function formatNotificationMessage(message: string): ReactNode {
  if (!message) return null;
  const parts = message.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong
          key={i}
          className="font-semibold text-gray-900 dark:text-white"
        >
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
