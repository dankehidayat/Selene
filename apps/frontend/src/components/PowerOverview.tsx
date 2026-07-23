// apps/frontend/src/components/PowerOverview.tsx
import { Zap, Activity, Gauge, DollarSign } from "lucide-react";

interface PowerOverviewProps {
  qualityScore: number | undefined;
  cosPhi: number | undefined;
  frequency: number | undefined;
  estimatedCost: string;
  totalKwh: string | number;
}

function getQualityLabel(score: number | undefined): string {
  if (score === undefined) return "No data";
  if (score >= 80) return "Excellent — your power quality is very good";
  if (score >= 60) return "Good — within acceptable range";
  if (score >= 40) return "Fair — some parameters need attention";
  return "Poor — power quality needs improvement";
}

function getCosPhiLabel(cp: number | undefined): string {
  if (cp === undefined) return "No data";
  if (cp >= 0.85) return "Good — efficient power usage";
  if (cp >= 0.6) return "Fair — consider power factor correction";
  return "Low — significant reactive power present";
}

function getFrequencyLabel(freq: number | undefined): string {
  if (freq === undefined) return "No data";
  if (freq >= 49.8 && freq <= 50.2) return "Stable — within normal range";
  if (freq >= 49.5 && freq <= 50.5)
    return "Slight deviation — monitoring recommended";
  return "Unstable — grid frequency outside normal range";
}

function getCostContext(cost: string, kwh: string | number): string {
  if (cost === "—" || kwh === "—") return "No data available";
  if (typeof kwh === "number" && kwh < 0.5) return "Very low consumption today";
  if (typeof kwh === "number" && kwh < 2) return "Moderate consumption today";
  return "Higher than usual consumption";
}

export function PowerOverview({
  qualityScore,
  cosPhi,
  frequency,
  estimatedCost,
  totalKwh,
}: PowerOverviewProps) {
  return (
    <div className="space-y-4 mt-1">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Power Quality Score
          </p>
        </div>
        <p className="text-3xl font-semibold text-gray-900 dark:text-white">
          {qualityScore?.toFixed(0) ?? "—"}
          <span className="text-base text-gray-400 dark:text-gray-500">
            /100
          </span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {getQualityLabel(qualityScore)}
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">cos φ</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {cosPhi?.toFixed(2) ?? "—"}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {getCosPhiLabel(cosPhi)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Frequency</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {frequency?.toFixed(1) ?? "—"} Hz
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {getFrequencyLabel(frequency)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Energy Cost (24h)
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {estimatedCost}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {getCostContext(estimatedCost, totalKwh)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Consumption (24h)
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalKwh !== "—" ? `${totalKwh} kWh` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
