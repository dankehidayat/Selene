// apps/frontend/src/hooks/useChartWidth.ts
import { useEffect, useRef, useState } from "react";

/**
 * Measure the live rendered width of a container element with a ResizeObserver.
 * Returns a ref to attach to the element and its current width (px). Charts use
 * this to pick narrow-vs-wide margins, tick counts and legend placement so they
 * stay legible on small phones instead of squishing.
 */
export function useChartWidth<T extends HTMLElement>(): [
  React.RefObject<T>,
  number,
] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (w: number) => setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}
