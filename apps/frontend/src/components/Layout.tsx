// [apps/frontend] src/components/Layout.tsx
import { useState, type ReactNode } from "react";
import { SidebarContent } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-gray-950 flex">
      <aside
        className={`hidden lg:block bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0 transition-all duration-300 overflow-hidden sticky top-0 h-screen ${sidebarOpen ? "w-[248px]" : "w-0"}`}
      >
        <div className="w-[248px] h-full flex flex-col">
          <SidebarContent />
        </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/30 dark:bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[248px] bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl animate-slideIn h-screen flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onMobileMenu={() => setMobileOpen(true)}
        />
        <main className="p-5 lg:p-8 space-y-6">{children}</main>
      </div>
    </div>
  );
}
