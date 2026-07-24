// apps/frontend/src/components/TopBar.tsx
import {
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/services/auth";
import {
  hrefForNavItem,
  searchNavItems,
  type NavSearchItem,
} from "@/lib/navSearch";

function useIsApplePlatform(): boolean {
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    const p = navigator.platform || "";
    const ua = navigator.userAgent || "";
    setIsApple(/Mac|iPhone|iPad|iPod/i.test(p) || /Mac OS X/i.test(ua));
  }, []);
  return isApple;
}

/** Keyboard shortcut hint: ⌘K on Apple, Ctrl+K elsewhere. */
function ShortcutHint({ isApple }: { isApple: boolean }) {
  if (isApple) {
    return (
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
        ⌘K
      </kbd>
    );
  }
  return (
    <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
      Ctrl&nbsp;K
    </kbd>
  );
}

export function TopBar({
  onToggleSidebar,
  onMobileMenu,
  sidebarOpen,
}: {
  onToggleSidebar: () => void;
  onMobileMenu: () => void;
  sidebarOpen: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isApple = useIsApplePlatform();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchNavItems(query, { isAdmin }),
    [query, isAdmin],
  );

  const shortcutLabel = isApple ? "⌘K" : "Ctrl+K";

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (item: NavSearchItem) => {
    setQuery("");
    setOpen(false);
    void (navigate as (opts: { to: string }) => Promise<void>)({
      to: item.to,
    }).then(() => {
      if (item.tab) {
        window.history.replaceState(
          window.history.state,
          "",
          hrefForNavItem(item),
        );
        window.dispatchEvent(
          new CustomEvent("selene:tab", { detail: { tab: item.tab } }),
        );
      } else if (window.location.search) {
        window.history.replaceState(window.history.state, "", item.to);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIdx] ?? results[0];
      if (item) go(item);
    }
  };

  const DesktopSidebarIcon = sidebarOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 lg:px-8 py-4 border-b border-gray-200/50 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
      {/* Left: sidebar toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          className="hidden lg:inline-flex text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <DesktopSidebarIcon size={20} />
        </button>
        <button
          type="button"
          className="lg:hidden inline-flex text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onMobileMenu}
          title="Open menu"
          aria-label="Open menu"
        >
          <PanelLeft size={20} />
        </button>
      </div>

      {/* Center: global search */}
      <div ref={rootRef} className="relative w-full max-w-xl mx-auto min-w-0">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, tabs…"
            className="w-full h-10 pl-9 pr-[4.5rem] rounded-xl bg-gray-100/80 dark:bg-gray-800/80 border border-transparent focus:border-blue-300 dark:focus:border-blue-700 focus:bg-white dark:focus:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition"
            autoComplete="off"
            spellCheck={false}
            aria-label={`Search (${shortcutLabel})`}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {query ? (
              <button
                type="button"
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <ShortcutHint isApple={isApple} />
            )}
          </div>
        </div>

        {open && query.trim() && (
          <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden z-50 animate-fadeScaleIn origin-top">
            {results.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-gray-500 dark:text-gray-400">
                No matches for “{query.trim()}”
              </p>
            ) : (
              <ul className="py-1 max-h-72 overflow-y-auto" role="listbox">
                {results.map((item, idx) => (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={idx === activeIdx}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => go(item)}
                      className={`w-full text-left px-3.5 py-2.5 transition ${
                        idx === activeIdx
                          ? "bg-blue-50 dark:bg-blue-900/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.description}
                        {item.tab ? (
                          <span className="text-gray-400 dark:text-gray-500">
                            {" "}
                            · tab
                          </span>
                        ) : null}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Right: notifications (original placement) */}
      <div className="flex justify-end shrink-0">
        <NotificationBell />
      </div>
    </header>
  );
}
