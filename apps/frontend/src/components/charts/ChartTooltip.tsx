// src/components/charts/ChartTooltip.tsx
// Shared tooltip card + value formatting for all Nivo charts.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The one tooltip card look. Every chart tooltip uses this. */
export const chartTooltipClass =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans";

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

/** A single tooltip row: color dot + label + right-aligned tabular value. */
export function TooltipRow({
  label,
  value,
  color,
  unit,
}: {
  label: string;
  value: string | number;
  color?: string;
  unit?: string;
}) {
  return (
    <p className="text-gray-400 dark:text-gray-400 flex items-center gap-2">
      {color ? (
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {label}:{" "}
      <span className="text-gray-900 dark:text-white font-semibold tabular-nums">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
    </p>
  );
}
