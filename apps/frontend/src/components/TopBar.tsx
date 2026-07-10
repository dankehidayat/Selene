// apps/frontend/src/components/TopBar.tsx - Updated with notification bell
import { PanelRight } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

export function TopBar({
  onToggleSidebar,
  onMobileMenu,
}: {
  onToggleSidebar: () => void;
  onMobileMenu: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-5 lg:px-8 py-5 border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          className="hidden lg:block text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          onClick={onToggleSidebar}
        >
          <PanelRight size={20} />
        </button>
        <button
          className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          onClick={onMobileMenu}
        >
          <PanelRight size={20} />
        </button>
      </div>
      <NotificationBell />
    </header>
  );
}
