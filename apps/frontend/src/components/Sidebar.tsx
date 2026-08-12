// apps/frontend/src/components/Sidebar.tsx
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScrollText,
  LineChart,
  LogIn,
  Info,
  BookOpen,
  Settings,
  Sun,
  Moon,
  Monitor,
  Shield,
} from "lucide-react";
import { useAuth } from "@/services/auth";
import { useState, useEffect } from "react";
import { useSettings } from "@/components/SettingsOverlay";
import { SeleneMark } from "@/components/SeleneMark";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) || "system";
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

const mainItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Data Log", to: "/log", icon: ScrollText },
  { label: "Analytics", to: "/analytics", icon: LineChart },
] as const;

const infoItems = [
  { label: "Impressum", to: "/impressum", icon: Info },
  { label: "Glossary", to: "/glossary", icon: BookOpen },
] as const;

const linkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all duration-200 active:scale-[0.98]";
const activeBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400";

export function SidebarContent({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
  onToggleCompact?: () => void;
} = {}) {
  const { user } = useAuth();
  const { openSettings } = useSettings();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [themePulse, setThemePulse] = useState(false);
  const [gearSpin, setGearSpin] = useState(false);

  const handleOpenSettings = () => {
    setGearSpin(true);
    openSettings();
    window.setTimeout(() => setGearSpin(false), 520);
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const cycleTheme = () => {
    setThemePulse(true);
    setTheme((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light",
    );
    window.setTimeout(() => setThemePulse(false), 280);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeTooltip =
    theme === "light"
      ? "Light mode"
      : theme === "dark"
        ? "Dark mode"
        : "System theme";

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 pt-5 pb-3 shrink-0 ${compact ? "justify-center px-0" : "px-5"}`}>
        <SeleneMark size={36} className="shrink-0 rounded-xl" />
        {!compact && (
          <div>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
              Selene
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Smart Energy & Climate
            </p>
          </div>
        )}
      </div>

      {/* Navigation — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {compact ? (
          <nav className="px-2 flex flex-col items-center gap-1">
            {mainItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => onNavigate?.()}
                className={`${linkBase} w-10 h-10 justify-center px-0`}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{
                  className: `${activeBase} w-10 h-10 justify-center px-0`,
                }}
                title={item.label}
                aria-label={item.label}
              >
                <item.icon size={16} />
              </Link>
            ))}
            {user?.role === "ADMIN" && (
              <>
                <div className="w-6 border-t border-gray-200 dark:border-gray-700 my-1" />
                <Link
                  to="/admin"
                  onClick={() => onNavigate?.()}
                  className={`${linkBase} w-10 h-10 justify-center px-0`}
                  activeProps={{
                    className: `${activeBase} w-10 h-10 justify-center px-0`,
                  }}
                  title="Admin Tools"
                  aria-label="Admin Tools"
                >
                  <Shield size={16} />
                </Link>
              </>
            )}
            <div className="w-6 border-t border-gray-200 dark:border-gray-700 my-1" />
            {infoItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => onNavigate?.()}
                className={`${linkBase} w-10 h-10 justify-center px-0`}
                activeProps={{
                  className: `${activeBase} w-10 h-10 justify-center px-0`,
                }}
                title={item.label}
                aria-label={item.label}
              >
                <item.icon size={16} />
              </Link>
            ))}
          </nav>
        ) : (
          <>
            <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Main
            </p>
            <nav className="px-3 space-y-0.5 pb-4">
              {mainItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => onNavigate?.()}
                  className={linkBase}
                  activeOptions={{ exact: item.to === "/" }}
                  activeProps={{ className: activeBase }}
                  title={compact ? item.label : undefined}
                  aria-label={compact ? item.label : undefined}
                >
                  <item.icon size={16} />
                  {!compact && item.label}
                </Link>
              ))}
            </nav>

            {/* Administration — Admin Only */}
            {user?.role === "ADMIN" && (
              <>
                <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-2">
                  Administration
                </p>
                <nav className="px-3 space-y-0.5 pb-4">
                  <Link
                    to="/admin"
                    onClick={() => onNavigate?.()}
                    className={linkBase}
                    activeProps={{ className: activeBase }}
                  >
                    <Shield size={16} />
                    Admin Tools
                  </Link>
                </nav>
              </>
            )}

            <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-2">
              Information
            </p>
            <nav className="px-3 space-y-0.5 pb-4">
              {infoItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => onNavigate?.()}
                  className={linkBase}
                  activeProps={{ className: activeBase }}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Bottom bar — always pinned (do not put inside scroll region) */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 shrink-0 bg-white dark:bg-gray-900 z-10">
        {user ? (
          compact ? (
            // Collapsed rail: a single profile monogram, centered — opens settings.
            <div className="flex items-center justify-center">
              <button
                onClick={handleOpenSettings}
                title="Account settings"
                aria-label="Account settings"
                className="p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    {initial}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {/* Avatar — opens settings */}
              <button
                onClick={handleOpenSettings}
                className="flex items-center gap-2.5 flex-1 min-w-0 px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left"
              >
                <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    {initial}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
                    {user.name || user.email}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {user.name ? user.email : "Account"}
                  </p>
                </div>
              </button>

              {/* Settings gear */}
              <button
                onClick={handleOpenSettings}
                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
                title="Settings"
                aria-label="Settings"
              >
                <Settings
                  size={15}
                  className={gearSpin ? "animate-gearSpin" : ""}
                />
              </button>

              {/* Theme toggle */}
              <button
                onClick={cycleTheme}
                className={`p-1.5 rounded-lg text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 shrink-0 active:scale-90 ${
                  themePulse ? "animate-themePop" : ""
                }`}
                title={themeTooltip}
                aria-label={themeTooltip}
              >
                <ThemeIcon
                  size={15}
                  className="transition-transform duration-200 stroke-[2]"
                />
              </button>
            </div>
          )
        ) : (
          <Link
            to="/login"
            onClick={() => onNavigate?.()}
            className={`${compact ? "w-10 h-10 justify-center px-0 mx-auto" : "flex items-center gap-3 px-3 py-2.5"} rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition`}
            title={compact ? "Sign In" : undefined}
            aria-label={compact ? "Sign In" : undefined}
          >
            <LogIn
              size={16}
              className="text-gray-400 dark:text-gray-500 shrink-0"
            />
            {!compact && <span>Sign In</span>}
          </Link>
        )}
      </div>
    </div>
  );
}
