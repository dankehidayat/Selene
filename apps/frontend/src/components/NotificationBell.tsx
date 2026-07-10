// apps/frontend/src/components/NotificationBell.tsx
// Change the fetchNotifications function to use React Query or add a simple cache:

import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, Zap, Thermometer, Shield, Activity } from "lucide-react";
import { useAuth } from "@/services/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface Notification {
  id: string;
  type: "energy" | "climate" | "security" | "system";
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

// Global cache to persist across page navigations
let notificationCache: Notification[] = [];
let unreadCache = 0;
let lastFetchTime = 0;

export function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] =
    useState<Notification[]>(notificationCache);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(unreadCache);

  useEffect(() => {
    if (!token) return;

    // Only fetch if cache is older than 30 seconds
    const shouldFetch = Date.now() - lastFetchTime > 30000;

    if (shouldFetch) {
      fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.notifications) {
            setNotifications(data.notifications);
            setUnreadCount(
              data.unreadCount ??
                data.notifications.filter((n: Notification) => !n.read).length,
            );
            notificationCache = data.notifications;
            unreadCache =
              data.unreadCount ??
              data.notifications.filter((n: Notification) => !n.read).length;
            lastFetchTime = Date.now();
          }
        });
    }
  }, [token]);

  const markAsRead = async (id: string) => {
    await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    notificationCache = notificationCache.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    unreadCache = Math.max(0, unreadCache - 1);
  };

  const markAllRead = async () => {
    await fetch(`${API_BASE}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    notificationCache = notificationCache.map((n) => ({ ...n, read: true }));
    unreadCache = 0;
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
        <button className="relative p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xl w-80 max-h-[400px] z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <Bell size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcons[n.type] || Activity;
                return (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-50 dark:border-gray-800 last:border-0 ${!n.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""}`}
                  >
                    <div className="flex gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${typeColors[n.type]}`}
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
