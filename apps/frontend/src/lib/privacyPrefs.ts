// apps/frontend/src/lib/privacyPrefs.ts
// Privacy preferences: essential + functional only (no analytics/marketing).

export type PrivacyPrefs = {
  /** Always required — auth, security, load balancing. */
  essential: true;
  /** Theme, notification prefs, UI layout (localStorage). */
  functional: boolean;
  /** ISO timestamp of last choice, or null if never set. */
  decidedAt: string | null;
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  essential: true,
  functional: true,
  decidedAt: null,
};

const STORAGE_KEY = "selene:privacyPrefs";

export function loadPrivacyPrefs(): PrivacyPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRIVACY_PREFS };
    const parsed = JSON.parse(raw) as Partial<PrivacyPrefs>;
    return {
      ...DEFAULT_PRIVACY_PREFS,
      functional:
        typeof parsed.functional === "boolean"
          ? parsed.functional
          : DEFAULT_PRIVACY_PREFS.functional,
      decidedAt: parsed.decidedAt ?? null,
      essential: true,
    };
  } catch {
    return { ...DEFAULT_PRIVACY_PREFS };
  }
}

export function savePrivacyPrefs(prefs: PrivacyPrefs): void {
  const next = {
    essential: true as const,
    functional: prefs.functional,
    decidedAt: prefs.decidedAt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent("selene:privacy-prefs", { detail: next }),
  );
}

export function hasPrivacyDecision(): boolean {
  return loadPrivacyPrefs().decidedAt != null;
}

export function acceptAllPrivacy(): PrivacyPrefs {
  const next: PrivacyPrefs = {
    essential: true,
    functional: true,
    decidedAt: new Date().toISOString(),
  };
  savePrivacyPrefs(next);
  return next;
}

export function rejectOptionalPrivacy(): PrivacyPrefs {
  const next: PrivacyPrefs = {
    essential: true,
    functional: false,
    decidedAt: new Date().toISOString(),
  };
  savePrivacyPrefs(next);
  return next;
}
