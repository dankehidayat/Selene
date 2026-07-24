// apps/frontend/src/lib/privacyPrefs.ts
// EU-oriented cookie / privacy preferences (client-side until backend consent API).

export type PrivacyPrefs = {
  /** Always required — auth, security, load balancing. */
  essential: true;
  /** Theme, notification prefs, UI layout (localStorage). */
  functional: boolean;
  /** Anonymous product analytics (not used yet — reserved). */
  analytics: boolean;
  /** Third-party marketing (off by default; Selene does not load ads). */
  marketing: boolean;
  /** ISO timestamp of last choice, or null if never set. */
  decidedAt: string | null;
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  essential: true,
  functional: true,
  analytics: false,
  marketing: false,
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
      ...parsed,
      essential: true,
    };
  } catch {
    return { ...DEFAULT_PRIVACY_PREFS };
  }
}

export function savePrivacyPrefs(prefs: PrivacyPrefs): void {
  const next = { ...prefs, essential: true as const };
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
    analytics: true,
    marketing: false,
    decidedAt: new Date().toISOString(),
  };
  savePrivacyPrefs(next);
  return next;
}

export function rejectOptionalPrivacy(): PrivacyPrefs {
  const next: PrivacyPrefs = {
    essential: true,
    functional: true,
    analytics: false,
    marketing: false,
    decidedAt: new Date().toISOString(),
  };
  savePrivacyPrefs(next);
  return next;
}
