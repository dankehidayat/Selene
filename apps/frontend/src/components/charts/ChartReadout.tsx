// src/components/charts/ChartReadout.tsx
// Mobile pinned readout — a quiet bar below the chart showing the active
// point's values. Floating tooltips don't work well on touch (clip at viewport
// edges, no hover), so on narrow screens we show this persistent bar instead.
// Same visual language as ChartTooltip: hairline border, muted bg, dots +
// label + right-aligned tabular value. aria-live so screen readers announce
// value changes.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ReadoutRow {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
}

export function ChartReadout({
  header,
  rows,
  emptyHint = "Tap a point to see values",
  className,
}: {
  /** Optional header line (date, category, …). */
  header?: ReactNode;
  /** The metric rows to show. When empty, renders the empty-hint text. */
  rows: ReadoutRow[];
  /** Text shown when no point is active. */
  emptyHint?: string;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/60 px-3 py-2 text-xs leading-relaxed",
        className,
      )}
    >
      {header ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400 mb-1">
          {header}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-400">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {rows.map((r) => (
            <span
              key={r.label}
              className="inline-flex items-center gap-1.5 text-gray-400 dark:text-gray-400"
            >
              {r.color ? (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
              ) : null}
              <span>{r.label}:</span>
              <span className="text-gray-900 dark:text-white font-semibold tabular-nums">
                {r.value}
                {r.unit ? ` ${r.unit}` : ""}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}