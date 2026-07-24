// [apps/frontend] src/components/Layout.tsx
import { useEffect, useState, type ReactNode } from "react";
import { SidebarContent } from "./Sidebar";
import { TopBar } from "./TopBar";

const CLOSE_MS = 280;
const SIDEBAR_W = 248;

/**
 * Desktop sidebar uses transform (not width) so heavy pages like Analytics
 * don't reflow ResponsiveContainer charts on every animation frame.
 * Main content margin updates once at the start (open) or end (close).
 */
export function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /** Main content left inset — may lag behind sidebarOpen while closing. */
  const [mainPadded, setMainPadded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);

  const openMobile = () => {
    setMobileClosing(false);
    setMobileOpen(true);
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

  const toggleDesktopSidebar = () => {
    if (sidebarOpen) {
      // Close: slide panel away first, expand main after (one reflow, not continuous).
      setSidebarOpen(false);
      window.setTimeout(() => setMainPadded(false), CLOSE_MS);
    } else {
      // Open: reserve space first, then slide panel in.
      setMainPadded(true);
      requestAnimationFrame(() => setSidebarOpen(true));
    }
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
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-gray-950 overflow-x-hidden">
      {/* Desktop sidebar — fixed, transform only */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 z-30 w-[248px] h-dvh max-h-dvh bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-transform duration-300 ease-out will-change-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: SIDEBAR_W }}
        aria-hidden={!sidebarOpen}
      >
        <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
          <SidebarContent />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className={`absolute inset-0 bg-gray-900/30 dark:bg-black/50 transition-opacity ease-out ${
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

      <div
        className={`min-w-0 max-w-full transition-[margin] duration-0 ${
          mainPadded ? "lg:ml-[248px]" : "lg:ml-0"
        }`}
      >
        <TopBar
          onToggleSidebar={toggleDesktopSidebar}
          onMobileMenu={openMobile}
          sidebarOpen={sidebarOpen}
        />
        <main className="p-5 lg:p-8 space-y-6 animate-pageIn min-w-0 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
