// apps/frontend/src/components/NotificationToasts.tsx
// Auto-dismiss toast stack for new sensor / system notifications.
import { useEffect, useRef, useState } from "react";
import {
  Zap,
  Thermometer,
  Shield,
  Activity,
  X,
} from "lucide-react";
import { useAuth } from "@/services/auth";
import {
  isNotificationCategoryAllowed,
  loadNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notificationPrefs";
import { formatNotificationMessage } from "@/lib/formatNotification";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const POLL_MS = 12_000;
const TOAST_MS = 5_000;

type ToastNotif = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  expiresAt: number;
};

const typeIcons: Record<string, typeof Zap> = {
  energy: Zap,
  climate: Thermometer,
  security: Shield,
  system: Activity,
};

const typeStyles: Record<string, string> = {
  energy:
    "border-amber-200/80 dark:border-amber-800/50 bg-amber-50/95 dark:bg-amber-950/90",
  climate:
    "border-cyan-200/80 dark:border-cyan-800/50 bg-cyan-50/95 dark:bg-cyan-950/90",
  security:
    "border-violet-200/80 dark:border-violet-800/50 bg-violet-50/95 dark:bg-violet-950/90",
  system:
    "border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/95 dark:bg-emerald-950/90",
};

const barStyles: Record<string, string> = {
  energy: "bg-amber-400/80 dark:bg-amber-500/70",
  climate: "bg-cyan-400/80 dark:bg-cyan-500/70",
  security: "bg-violet-400/80 dark:bg-violet-500/70",
  system: "bg-emerald-400/80 dark:bg-emerald-500/70",
};

export function NotificationToasts() {
  const { token } = useAuth();
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    typeof window !== "undefined"
      ? loadNotificationPrefs()
      : {
          enabled: true,
          energy: true,
          climate: true,
          security: true,
          system: true,
        },
  );
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    const onPrefs = () => setPrefs(loadNotificationPrefs());
    window.addEventListener("selene:notification-prefs", onPrefs);
    return () => window.removeEventListener("selene:notification-prefs", onPrefs);
  }, []);

  useEffect(() => {
    if (!token || !prefs.enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled || !data.notifications) return;

        const list = data.notifications as ToastNotif[];
        if (!primedRef.current) {
          // Don't spam toasts for old history on first load
          list.forEach((n) => seenRef.current.add(n.id));
          primedRef.current = true;
          return;
        }

        const fresh = list.filter(
          (n) =>
            !seenRef.current.has(n.id) &&
            isNotificationCategoryAllowed(n.type, prefs),
        );
        fresh.forEach((n) => seenRef.current.add(n.id));

        if (fresh.length === 0) return;

        const now = Date.now();
        setToasts((prev) => [
          ...fresh.map((n) => ({
            ...n,
            expiresAt: now + TOAST_MS,
          })),
          ...prev,
        ].slice(0, 4));
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, prefs]);

  // Drop expired toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => t.expiresAt > now));
    }, 200);
    return () => window.clearInterval(id);
  }, [toasts.length]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!token || toasts.length === 0) return null;

  return (
    <div
      className="fixed top-16 sm:top-20 right-3 sm:right-5 z-[70] flex flex-col gap-2 w-[min(22rem,calc(100vw-1.5rem))] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = typeIcons[t.type] || Activity;
        const remaining = Math.max(0, t.expiresAt - Date.now());
        const pct = (remaining / TOAST_MS) * 100;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto relative overflow-hidden rounded-xl border shadow-lg backdrop-blur-md animate-toastIn ${
              typeStyles[t.type] || typeStyles.system
            }`}
          >
            <div className="flex gap-3 p-3.5 pr-2">
              <div className="h-9 w-9 rounded-full bg-white/70 dark:bg-black/20 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-gray-700 dark:text-gray-100" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                  {formatNotificationMessage(t.message)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            {/* Countdown bar — light color shrinks over 5s */}
            <div className="h-1 w-full bg-black/5 dark:bg-white/10">
              <div
                className={`h-full transition-[width] duration-200 ease-linear ${
                  barStyles[t.type] || barStyles.system
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
