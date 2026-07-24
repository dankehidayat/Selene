// apps/frontend/src/lib/chartDomain.ts
/** Y-axis domain with headroom so forecast lines aren't clipped at the top/bottom. */

export type AxisDomain = [
  number | "auto" | ((v: number) => number),
  number | "auto" | ((v: number) => number),
];

/**
 * Soft padding for Recharts YAxis.
 * Prefer function form so domain tracks live + forecast series.
 */
export function paddedYDomain(opts?: {
  /** Extra fraction above max (default 12%). */
  topPad?: number;
  /** Extra fraction below min (default 8%). */
  bottomPad?: number;
  /** Absolute floor for padding when values are near 0. */
  minPad?: number;
  /** Force non-negative axis (power, humidity, etc.). */
  clampZero?: boolean;
}): AxisDomain {
  const topPad = opts?.topPad ?? 0.12;
  const bottomPad = opts?.bottomPad ?? 0.08;
  const minPad = opts?.minPad ?? 1;
  const clampZero = opts?.clampZero ?? false;

  return [
    (dataMin: number) => {
      if (!Number.isFinite(dataMin)) return 0;
      const span = Math.abs(dataMin) || minPad;
      let lo = dataMin - Math.max(span * bottomPad, minPad);
      if (clampZero) lo = Math.max(0, lo);
      return lo;
    },
    (dataMax: number) => {
      if (!Number.isFinite(dataMax)) return minPad;
      const span = Math.abs(dataMax) || minPad;
      return dataMax + Math.max(span * topPad, minPad);
    },
  ];
}
