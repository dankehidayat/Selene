/**
 * Cap chart series to ~2 samples per CSS pixel (shape-preserving LTTB on server).
 * Clamped so phones stay light and ultrawide desktops don't explode payload size.
 */
export function maxPointsForWidth(widthPx: number): number {
  const w = Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 640;
  return Math.max(64, Math.min(800, Math.ceil(w * 2)));
}

/** Estimate usable chart width from viewport (sidebar ~248, padding). */
export function estimateChartWidth(): number {
  if (typeof window === "undefined") return 640;
  const vw = window.innerWidth || 640;
  // mobile: full width minus page padding; desktop: main column
  if (vw < 768) return Math.max(280, vw - 32);
  if (vw < 1280) return Math.max(360, vw - 280);
  return Math.min(1100, vw - 320);
}

export function useViewportChartMaxPoints(): number {
  // Lazy import pattern avoided — callers can use useState+effect; this is pure default.
  return maxPointsForWidth(estimateChartWidth());
}
