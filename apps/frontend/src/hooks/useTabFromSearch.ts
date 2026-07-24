// apps/frontend/src/hooks/useTabFromSearch.ts
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Keep local tab state in sync with ?tab= in the URL.
 * Works with TopBar search deep-links and browser back/forward.
 */
export function useTabFromSearch<T extends string>(
  allowed: readonly T[],
  setTab: (tab: T) => void,
) {
  const searchStr = useRouterState({
    select: (s) => {
      const loc = s.location as {
        searchStr?: string;
        search?: unknown;
        href?: string;
      };
      if (typeof loc.searchStr === "string" && loc.searchStr.length > 0) {
        return loc.searchStr.startsWith("?")
          ? loc.searchStr.slice(1)
          : loc.searchStr;
      }
      if (typeof loc.search === "string") {
        return loc.search.startsWith("?") ? loc.search.slice(1) : loc.search;
      }
      if (loc.search && typeof loc.search === "object") {
        return new URLSearchParams(
          loc.search as Record<string, string>,
        ).toString();
      }
      // Fallback: full browser URL (covers history.replaceState after navigate)
      if (typeof window !== "undefined") {
        return window.location.search.replace(/^\?/, "");
      }
      return "";
    },
  });

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  useEffect(() => {
    const apply = () => {
      try {
        const fromRouter = searchStr;
        const fromWindow =
          typeof window !== "undefined"
            ? window.location.search.replace(/^\?/, "")
            : "";
        const params = new URLSearchParams(fromRouter || fromWindow);
        const raw = params.get("tab");
        if (!raw) return;
        if ((allowed as readonly string[]).includes(raw)) {
          setTab(raw as T);
        }
      } catch {
        /* ignore */
      }
    };

    apply();

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string }>).detail;
      if (detail?.tab && (allowed as readonly string[]).includes(detail.tab)) {
        setTab(detail.tab as T);
      }
    };

    window.addEventListener("popstate", apply);
    window.addEventListener("selene:tab", onCustom as EventListener);
    return () => {
      window.removeEventListener("popstate", apply);
      window.removeEventListener("selene:tab", onCustom as EventListener);
    };
  }, [allowed, setTab, searchStr, pathname]);
}
