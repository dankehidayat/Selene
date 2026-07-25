// [apps/frontend] src/components/StatCard.tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/InfoTip";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  iconColor?: string;
  sub?: string;
  subTone?: string;
  /** Optional disclosure next to the label */
  infoTitle?: string;
  infoContent?: string;
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  iconColor = "text-gray-600 dark:text-gray-400",
  sub,
  subTone = "text-gray-600 dark:text-gray-300",
  infoTitle,
  infoContent,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <span className="text-sm text-gray-900 dark:text-white font-medium inline-flex items-center gap-1 min-w-0">
          <span className="truncate">{label}</span>
          {infoTitle && infoContent ? (
            <InfoTip title={infoTitle} content={infoContent} iconSize={13} />
          ) : null}
        </span>
        <Icon size={16} className={cn(iconColor, "shrink-0")} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[26px] font-semibold text-gray-900 dark:text-white tabular-nums leading-none transition-all duration-300">
          {value}
          {unit ? (
            <span className="text-base font-semibold text-gray-900 dark:text-white ml-1">
              {unit}
            </span>
          ) : null}
        </span>
        {sub ? (
          <span className={cn("text-xs font-medium", subTone)}>{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

export const TOTAL_ENERGY_INFO = {
  title: "How total energy is calculated",
  content:
    "This is energy used over the selected time range, in kilowatt-hours (kWh). The meter on the device keeps a running total of energy. Selene records that total with each reading, then adds up how much it rose during the range (and handles meter resets). It is not a rough guess from average power times every hour, which can overstate usage when samples are sparse. The latest meter reading is the lifetime total; this card shows only what was used inside the range you picked.",
} as const;

export const EST_COST_INFO = {
  title: "How estimated cost is calculated",
  content:
    "Estimated cost multiplies total energy (kWh) for the selected period by Rp 1.444,70 per kWh. That is the official PLN R-1/TR rate for 1.300 to 2.200 VA non-subsidized residential customers for Q3 2026 (July to September), set by ESDM/PLN and unchanged this quarter. This is a guide only. Your real bill can also include street lighting tax (PPJ) and other fees.",
} as const;
