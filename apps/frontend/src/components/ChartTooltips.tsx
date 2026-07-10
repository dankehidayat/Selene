  import type { TooltipProps } from "recharts";

  export function BarTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-lg px-3.5 py-2.5 text-xs">
        <p className="text-gray-400 mb-1">
          Month: <span className="text-gray-700 font-medium">{label}</span>
        </p>
        <p className="text-gray-400">
          Usage: <span className="text-gray-900 font-semibold">{payload[0].value} kWh</span>
        </p>
      </div>
    );
  }

  export function TempTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 text-white rounded-lg px-3 py-1.5 text-xs shadow-lg">
        <span className="text-gray-400 mr-1.5">Temp</span>
        <span className="font-semibold">{payload[0].value}°C</span>
      </div>
    );
  }
