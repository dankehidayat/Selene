// [apps/frontend] src/components/Layout.tsx
import { useEffect, useState, type ReactNode } from "react";
import { SidebarContent } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CookieBanner } from "./CookieBanner";
import {
  ShellLayoutProvider,
  useShellLayout,
  SHELL_SIDEBAR_W,
  SHELL_SIDEBAR_MS,
} from "@/lib/shellLayout";

const CLOSE_MS = 280;

function LayoutShell({ children }: { children: ReactNode }) {
  const { sidebarOpen, toggleSidebar } = useShellLayout();
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
      {/*
        Sidebar slides with transform; main margin animates in the same duration
        so content shrinks/grows. Charts freeze resize via StableResponsiveContainer
        while html.sidebar-resizing is set (see shellLayout).
      */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 z-30 h-dvh max-h-dvh bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-transform ease-out will-change-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: SHELL_SIDEBAR_W,
          transitionDuration: `${SHELL_SIDEBAR_MS}ms`,
        }}
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
        className={`min-w-0 max-w-full transition-[margin] ease-out ${
          sidebarOpen ? "lg:ml-[248px]" : "lg:ml-0"
        }`}
        style={{ transitionDuration: `${SHELL_SIDEBAR_MS}ms` }}
      >
        <TopBar
          onToggleSidebar={toggleSidebar}
          onMobileMenu={openMobile}
          sidebarOpen={sidebarOpen}
        />
        <main className="p-5 lg:p-8 space-y-6 animate-pageIn min-w-0 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      <CookieBanner />
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <ShellLayoutProvider>
      <LayoutShell>{children}</LayoutShell>
    </ShellLayoutProvider>
  );
}
