// [apps/frontend] src/components/StatCard.tsx - ALL BLACK text in light mode
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  iconColor?: string;
  sub?: string;
  subTone?: string;
}

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  iconColor = "text-gray-600 dark:text-gray-400",
  sub,
  subTone = "text-gray-600 dark:text-gray-300",
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-900 dark:text-white font-medium">
          {label}
        </span>
        <Icon size={16} className={iconColor} />
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
