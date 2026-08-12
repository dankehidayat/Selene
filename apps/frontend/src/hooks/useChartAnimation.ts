// apps/frontend/src/hooks/useChartAnimation.ts
import { useMemo } from "react";

/**
 * Returns whether chart animations should be enabled.
 * Respects the user's `prefers-reduced-motion` OS setting.
 */
export function useChartAnimation(): boolean {
  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return !reduceMotion;
}