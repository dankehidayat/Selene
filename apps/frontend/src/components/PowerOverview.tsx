// apps/frontend/src/components/PowerOverview.tsx

interface PowerOverviewProps {
  qualityScore: number | undefined;
  cosPhi: number | undefined;
  frequency: number | undefined;
  estimatedCost: string;
  totalKwh: string | number;
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
        <p className="text-3xl font-semibold text-gray-900 dark:text-white">
          {qualityScore?.toFixed(0) ?? "—"}
          <span className="text-base text-gray-400 dark:text-gray-500">
            /100
          </span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Composite quality score
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">cos φ</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {cosPhi?.toFixed(2) ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Frequency</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {frequency?.toFixed(1) ?? "—"} Hz
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Energy Cost (24h)
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {estimatedCost}
          </span>
        </div>
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
  );
}
