// apps/frontend/src/hooks/useIsDarkMode.ts
import { useEffect, useState } from "react";

/** Live dark-mode flag — mirrors the `dark` class on <html>. */
export function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return dark;
}