// src/components/charts/ChartTooltip.tsx
// Shared tooltip card + value formatting for all Nivo charts.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The one tooltip card look. Every chart tooltip uses this.
 *  Soft overlay shadow + hairline border; width-clamped and wrapping so it
 *  never runs off the screen edge, on any viewport. */
export const chartTooltipClass =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-overlay px-3.5 py-2.5 text-xs font-sans min-w-[180px] max-w-[260px] whitespace-normal";

/** Wrapper card. Pass tooltip rows as children. */
export function ChartTooltipCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(chartTooltipClass, className)}>{children}</div>;
}

/**
 * Format a numeric tooltip value to `decimals` places, stripping insignificant
 * trailing zeros (2.50 -> "2.5", 3.00 -> "3"). Always tabular-friendly.
 */
export function formatTooltipValue(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return String(Number(value.toFixed(decimals)));
}

/** Shared muted-caption header (date, category, …) with an optional divider.
 *  One header style across every chart (kills the gray-vs-bold drift). */
export function TooltipHeader({
  children,
  divider = true,
  className,
}: {
  children: ReactNode;
  divider?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400",
        divider && "border-b border-gray-100 dark:border-gray-700 pb-1.5 mb-1.5",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A single tooltip row: color dot + label (left) + right-aligned tabular
 *  value. Right-aligned so columns of values scan, per the Tabular Rule. */
export function TooltipRow({
  label,
  value,
  color,
  unit,
  className,
}: {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center justify-between gap-4 text-gray-400 dark:text-gray-400",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        {color ? (
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-gray-900 dark:text-white font-semibold tabular-nums shrink-0">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
    </p>
  );
}
