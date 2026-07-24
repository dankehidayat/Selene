// apps/frontend/src/components/NotificationBell.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Bell,
  Zap,
  Thermometer,
  Shield,
  Activity,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "@/services/auth";
import {
  isNotificationCategoryAllowed,
  loadNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notificationPrefs";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const POLL_INTERVAL = 45_000;

interface Notification {
  id: string;
  type: "energy" | "climate" | "security" | "system" | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const typeIcons: Record<string, typeof Zap> = {
  energy: Zap,
  climate: Thermometer,
  security: Shield,
  system: Activity,
};

const typeColors: Record<string, string> = {
  energy: "text-amber-500 bg-amber-50 dark:bg-amber-900/30",
  climate: "text-cyan-500 bg-cyan-50 dark:bg-cyan-900/30",
  security: "text-violet-500 bg-violet-50 dark:bg-violet-900/30",
  system: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30",
};

export function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clearing, setClearing] = useState(false);
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (mountedRef.current && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!token) return;

    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    const onPrefs = () => setPrefs(loadNotificationPrefs());
    window.addEventListener("selene:notification-prefs", onPrefs);
    window.addEventListener("storage", onPrefs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("selene:notification-prefs", onPrefs);
      window.removeEventListener("storage", onPrefs);
    };
  }, [token]);

  const visible = useMemo(
    () =>
      notifications.filter((n) =>
        isNotificationCategoryAllowed(n.type, prefs),
      ),
    [notifications, prefs],
  );

  useEffect(() => {
    setUnreadCount(visible.filter((n) => !n.read).length);
  }, [visible]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
      }
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      /* ignore */
    }
  };

  const clearAll = async () => {
    if (!token || notifications.length === 0) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch {
      /* ignore */
    } finally {
      setClearing(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  if (!token) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 active:scale-90">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xl w-80 max-h-[420px] z-50 animate-fadeScaleIn origin-top-right"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} />
                  Read all
                </button>
              )}
              {visible.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={clearing}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
                  title="Delete all notifications"
                >
                  <Trash2 size={12} />
                  {clearing ? "Clearing…" : "Clear all"}
                </button>
              )}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[340px]">
            {!prefs.enabled ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Notifications paused</p>
                <p className="text-[11px] mt-1 text-center px-6">
                  Turn them back on in Settings → Notifications
                </p>
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
                <p className="text-[11px] mt-1 text-center px-6">
                  Login, energy, and climate alerts appear here
                </p>
              </div>
            ) : (
              visible.map((n) => {
                const Icon = typeIcons[n.type] || Activity;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.read) markAsRead(n.id);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-50 dark:border-gray-800 last:border-0 ${!n.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${typeColors[n.type] || typeColors.system}`}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
