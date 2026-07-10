import * as Separator from "@radix-ui/react-separator";
import type { PowerQuality } from "@/types/energy";

export function PowerQualityPanel({ data }: { data: PowerQuality }) {
  return (
    <div className="space-y-4 mt-1">
      <div>
        <p className="text-3xl font-semibold text-gray-900">
          {data.qualityScore}
          <span className="text-base text-gray-400">/100</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Composite quality score</p>
      </div>

      <Separator.Root className="h-px bg-gray-100" />

      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">cos φ</span>
          <span className="font-medium text-gray-900">{data.cosPhi}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Frequency</span>
          <span className="font-medium text-gray-900">{data.frequency} Hz</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Voltage stability</span>
          <span className="font-medium text-emerald-600">{data.voltageStability}%</span>
        </div>
      </div>
    </div>
  );
}
