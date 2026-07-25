// apps/frontend/src/lib/chartDomain.ts
/**
 * Explicit [min, max] from series values (actual + forecast).
 * Use this when charts plot multiple `data` arrays — Recharts function
 * domains only see the primary series and mis-scale forecasts.
 */

export function computeDomain(
  values: Array<number | null | undefined>,
  opts?: {
    /** Fraction of span to pad (default 10%). */
    pad?: number;
    minPad?: number;
    floor?: number | null;
    ceil?: number | null;
  },
): [number, number] {
  const padFrac = opts?.pad ?? 0.1;
  const minPad = opts?.minPad ?? 0.5;
  const nums = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );

  if (!nums.length) return [0, 1];

  let min = Math.min(...nums);
  let max = Math.max(...nums);

  if (min === max) {
    const d = Math.max(Math.abs(min) * 0.1, minPad);
    min -= d;
    max += d;
  } else {
    const span = max - min;
    const pad = Math.max(span * padFrac, minPad);
    min -= pad;
    max += pad;
  }

  if (opts?.floor != null) min = Math.max(opts.floor, min);
  if (opts?.ceil != null) max = Math.min(opts.ceil, max);
  if (min >= max) max = min + minPad;

  return [min, max];
}

/** Safe fallback when you only have the primary series. */
export function paddedYDomain(_opts?: {
  topPad?: number;
  bottomPad?: number;
  minPad?: number;
  clampZero?: boolean;
}): ["auto", "auto"] {
  // Always auto — explicit computeDomain is preferred for forecast charts
  return ["auto", "auto"];
}
