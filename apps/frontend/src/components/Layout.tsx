// [apps/frontend] src/components/Layout.tsx
import { useEffect, useState, type ReactNode } from "react";
import { SidebarContent } from "./Sidebar";
import { TopBar } from "./TopBar";

const CLOSE_MS = 280;

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);

  const openMobile = () => {
    setMobileClosing(false);
    setMobileOpen(true);
    // next frame so enter animation runs
    requestAnimationFrame(() => setMobileVisible(true));
  };

  const closeMobile = () => {
    if (mobileClosing || !mobileOpen) return;
    setMobileClosing(true);
    setMobileVisible(false);
    window.setTimeout(() => {
      setMobileOpen(false);
      setMobileClosing(false);
    }, CLOSE_MS);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, mobileClosing]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-gray-950 flex">
      <aside
        className={`hidden lg:block bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shrink-0 transition-all duration-300 ease-out overflow-hidden sticky top-0 h-dvh max-h-dvh ${sidebarOpen ? "w-[248px]" : "w-0"}`}
      >
        <div className="w-[248px] h-full min-h-0 flex flex-col overflow-hidden">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className={`absolute inset-0 bg-gray-900/30 dark:bg-black/50 transition-opacity duration-280 ease-out ${
              mobileVisible && !mobileClosing ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: `${CLOSE_MS}ms` }}
            onClick={closeMobile}
          />
          <aside
            className={`absolute left-0 top-0 w-[248px] h-dvh max-h-dvh bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] transition-transform ease-out ${
              mobileVisible && !mobileClosing
                ? "translate-x-0"
                : "-translate-x-full"
            }`}
            style={{ transitionDuration: `${CLOSE_MS}ms` }}
          >
            <SidebarContent onNavigate={closeMobile} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onMobileMenu={openMobile}
        />
        <main className="p-5 lg:p-8 space-y-6 animate-pageIn">{children}</main>
      </div>
    </div>
  );
}
