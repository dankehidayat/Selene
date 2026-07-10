// [apps/frontend] src/components/Sidebar.tsx
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScrollText,
  LineChart,
  LogIn,
  Info,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/services/auth";
import { AccountMenu } from "./AccountMenu";

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8 shrink-0">
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

      <div className="flex-1 overflow-y-auto">
        <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
          Main
        </p>
        <nav className="px-3 space-y-0.5">
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

        <p className="px-5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-6">
          Information
        </p>
        <nav className="px-3 space-y-0.5">
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

      <div className="border-t border-gray-100 dark:border-gray-800 px-3 pt-3 pb-6 shrink-0">
        {user ? (
          <AccountMenu />
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition"
          >
            <LogIn
              size={16}
              className="text-gray-400 dark:text-gray-500 shrink-0"
            />{" "}
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
}
