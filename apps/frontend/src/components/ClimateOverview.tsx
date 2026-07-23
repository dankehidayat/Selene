// apps/frontend/src/components/ClimateOverview.tsx
import { Thermometer, Droplets } from "lucide-react";

interface ClimateOverviewProps {
  temperature: number | undefined;
  humidity: number | undefined;
  comfort: string | undefined;
}

function getComfortColor(c: string | undefined): string {
  if (!c) return "text-gray-400 dark:text-gray-500";
  switch (c) {
    case "COLD":
      return "text-blue-600 dark:text-blue-400";
    case "COOL":
      return "text-cyan-600 dark:text-cyan-400";
    case "COMFORTABLE":
      return "text-emerald-600 dark:text-emerald-400";
    case "WARM":
      return "text-amber-600 dark:text-amber-400";
    case "HOT":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-400 dark:text-gray-500";
  }
}

function getComfortMessage(c: string | undefined): string {
  if (!c) return "No data available";
  switch (c) {
    case "COLD":
      return "The room feels cold. Consider heating if needed.";
    case "COOL":
      return "Slightly cool but still pleasant.";
    case "COMFORTABLE":
      return "The temperature is just right — ideal for productivity.";
    case "WARM":
      return "It's a bit warm. Ventilation may help.";
    case "HOT":
      return "The room is hot. Cooling is recommended.";
    default:
      return "";
  }
}

function getHumidityMessage(h: number | undefined): string {
  if (h === undefined) return "";
  if (h > 70) return "Humidity is high — it may feel muggy.";
  if (h < 40) return "Air is dry — a humidifier could help.";
  return "Humidity is at a comfortable level.";
}

export function ClimateOverview({
  temperature,
  humidity,
  comfort,
}: ClimateOverviewProps) {
  return (
    <div className="space-y-4 mt-1">
      <div className="flex items-center gap-4">
        <Thermometer size={20} className="text-rose-500 shrink-0" />
        <div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
            {temperature?.toFixed(1) ?? "—"}
            <span className="text-sm font-semibold text-gray-900 dark:text-white ml-0.5">
              °C
            </span>
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {comfort
              ? `Feels ${comfort.charAt(0) + comfort.slice(1).toLowerCase()}`
              : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Droplets size={20} className="text-blue-500 shrink-0" />
        <div>
          <span className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
            {humidity?.toFixed(0) ?? "—"}
            <span className="text-sm font-semibold text-gray-900 dark:text-white ml-0.5">
              %
            </span>
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {humidity !== undefined
              ? humidity > 70
                ? "High"
                : humidity < 40
                  ? "Low"
                  : "Normal"
              : "—"}
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <p className={`text-sm font-semibold ${getComfortColor(comfort)}`}>
          {comfort ? comfort.charAt(0) + comfort.slice(1).toLowerCase() : "—"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          {getComfortMessage(comfort)}
          {humidity !== undefined && <> {getHumidityMessage(humidity)}</>}
        </p>
      </div>
    </div>
  );
}
