// apps/frontend/src/components/AccountMenu.tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Settings, LogOut, ChevronUp, Sun, Moon, Monitor } from "lucide-react";
import { useAuth } from "@/services/auth";
import { useNavigate } from "@tanstack/react-router";
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

export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  if (!user) return null;

  const displayName = user.name || user.email;
  const displaySub = user.name ? user.email : "Account";
  const initial = user.name
    ? user.name.charAt(0).toUpperCase()
    : user.email.charAt(0).toUpperCase();
  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left outline-none">
          <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
              {initial}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {displaySub}
            </p>
          </div>
          <ChevronUp
            size={13}
            className="text-gray-400 dark:text-gray-500 shrink-0"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="top"
          sideOffset={8}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[14rem] z-50"
        >
          <DropdownMenu.Item
            onSelect={() => openSettings()}
            className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Settings size={14} /> User Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 data-[state=open]:bg-gray-50 dark:data-[state=open]:bg-gray-700">
              <ThemeIcon size={14} /> Appearance: {themeLabel}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                alignOffset={-8}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg py-1 min-w-[10rem] z-50"
              >
                <DropdownMenu.Item
                  onSelect={() => setTheme("light")}
                  className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Sun size={14} /> Light
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setTheme("dark")}
                  className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Moon size={14} /> Dark
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setTheme("system")}
                  className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Monitor size={14} /> System
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
          <DropdownMenu.Item
            onSelect={handleLogout}
            className="flex items-center gap-2.5 text-sm px-3 py-2 cursor-pointer outline-none rounded-lg mx-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <LogOut size={14} /> Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
