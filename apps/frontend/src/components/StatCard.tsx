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
    "Total energy uses the PZEM-004T cumulative energy counter (Wh → kWh) — the same hardware total Blynk shows — by summing positive increments over the selected range (resets are handled). It is not a sum of every power sample × full hour, which overestimates when readings are sparse. Conversion: 1 kWh = 1000 Wh.",
} as const;

export const EST_COST_INFO = {
  title: "How estimated cost is calculated",
  content:
    "Estimated cost = total energy (kWh) over the selected period × Rp 1.444,70 per kWh. Rate: PLN R-1/TR 1.300–2.200 VA non-subsidized residential, Triwulan III 2026 (Juli–September) — official ESDM/PLN flat tariff (unchanged). Energy itself comes from the PZEM cumulative Wh counter (same source as Blynk), not from summing power × full time buckets. Guide only — actual bills may add PPJ and admin fees.",
} as const;
