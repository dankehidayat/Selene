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
} from "lucide-react";
import { useAuth } from "@/services/auth";
import { useState, useEffect } from "react";
import { useSettings } from "@/components/SettingsOverlay";

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

export function SidebarContent() {
  const { user } = useAuth();
  const { openSettings } = useSettings();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

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
    setTheme((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light",
    );
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
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4 shrink-0">
        <img
          src="/icon.png"
          alt="Selene"
          className="h-9 w-9 rounded-xl shrink-0"
        />
        <div>
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
            Selene
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Smart Energy & Climate
          </p>
        </div>
      </div>

      {/* Navigation — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
          Main
        </p>
        <nav className="px-3 space-y-0.5 pb-4">
          {mainItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition"
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
              }}
            >
              <item.icon size={16} /> {item.label}
            </Link>
          ))}
        </nav>

        <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-2">
          Information
        </p>
        <nav className="px-3 space-y-0.5 pb-4">
          {infoItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
              }}
            >
              <item.icon size={16} /> {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom bar — avatar + settings + theme */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 shrink-0">
        {user ? (
          <div className="flex items-center gap-1.5">
            {/* Avatar — opens settings */}
            <button
              onClick={() => openSettings()}
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
              onClick={() => openSettings()}
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
              title="Settings"
            >
              <Settings size={15} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={cycleTheme}
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition shrink-0"
              title={themeTooltip}
            >
              <ThemeIcon size={15} />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition"
          >
            <LogIn
              size={16}
              className="text-gray-400 dark:text-gray-500 shrink-0"
            />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
}
