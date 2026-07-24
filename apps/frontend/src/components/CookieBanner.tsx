// apps/frontend/src/components/CookieBanner.tsx
import { useEffect, useState } from "react";
import {
  acceptAllPrivacy,
  hasPrivacyDecision,
  rejectOptionalPrivacy,
} from "@/lib/privacyPrefs";
import { useSettings } from "@/components/SettingsOverlay";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { openSettings } = useSettings();

  useEffect(() => {
    setVisible(!hasPrivacyDecision());
    const onChange = () => setVisible(!hasPrivacyDecision());
    window.addEventListener("selene:privacy-prefs", onChange);
    return () => window.removeEventListener("selene:privacy-prefs", onChange);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-2xl p-4 sm:p-5">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Cookies & privacy
        </p>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
          Selene uses essential cookies to keep you signed in and optional
          preferences (theme, notifications) on this device. We do not sell
          personal data. You can change your choice anytime in Settings →
          Privacy.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              acceptAllPrivacy();
              setVisible(false);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => {
              rejectOptionalPrivacy();
              setVisible(false);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => openSettings("privacy")}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition sm:ml-auto"
          >
            Manage preferences
          </button>
        </div>
      </div>
    </div>
  );
}
