// apps/frontend/src/lib/notificationPrefs.ts
// Client-side notification category preferences (localStorage).

export type NotificationCategory = "energy" | "climate" | "security" | "system";

export type NotificationPrefs = {
  /** Master switch — when false, no toasts/list items (except optional security). */
  enabled: boolean;
  energy: boolean;
  climate: boolean;
  security: boolean;
  system: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  energy: true,
  climate: true,
  security: true,
  system: true,
};

const STORAGE_KEY = "selene:notificationPrefs";

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  window.dispatchEvent(
    new CustomEvent("selene:notification-prefs", { detail: prefs }),
  );
}

export function isNotificationCategoryAllowed(
  type: string,
  prefs: NotificationPrefs = loadNotificationPrefs(),
): boolean {
  if (!prefs.enabled) return false;
  const t = (type || "system").toLowerCase();
  if (t === "energy" || t === "power") return prefs.energy;
  if (t === "climate" || t === "environment") return prefs.climate;
  if (t === "security" || t === "auth" || t === "login") return prefs.security;
  if (t === "system" || t === "ota" || t === "firmware") return prefs.system;
  return prefs.system;
}
