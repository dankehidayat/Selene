// [apps/frontend] src/pages/Dashboard.tsx
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Zap, Activity, Gauge, Thermometer, Droplets } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ChartCard, RangeSelect } from "@/components/ChartCard";
import { useLiveReading, useReadingHistory } from "@/services/api";

const RANGE_OPTIONS = ["1h", "24h", "7d", "30d", "3m", "6m", "1y"] as const;

function formatDateForTooltip(iso: string, range: string): string {
  const d = new Date(iso);
  switch (range) {
    case "1h":
    case "24h":
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    case "7d":
      return (
        d.toLocaleDateString([], { weekday: "short" }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    case "30d":
    case "3m":
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    case "6m":
    case "1y":
      return d.toLocaleDateString([], { month: "long", year: "numeric" });
    default:
      return d.toLocaleString();
  }
}
function formatTick(v: string, range: string): string {
  const d = new Date(v);
  switch (range) {
    case "1h":
    case "24h":
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    case "7d":
      return d.toLocaleDateString([], { weekday: "short", hour: "2-digit" });
    case "30d":
    case "3m":
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    case "6m":
    case "1y":
      return d.toLocaleDateString([], { month: "short", year: "2-digit" });
    default:
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

const CHART_FONT = {
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
  fill: "#9CA3AF",
};
const TOOLTIP_CLASS =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans";

function BarTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  range: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {formatDateForTooltip(label, range)}
        </span>
      </p>
      <p className="text-gray-400 dark:text-gray-400">
        Power:{" "}
        <span className="text-gray-900 dark:text-white font-semibold">
          {payload[0].value} W
        </span>
      </p>
    </div>
  );
}

function DualAxisTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
  range: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        Time:{" "}
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {formatDateForTooltip(label, range)}
        </span>
      </p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-gray-400 dark:text-gray-400">
          {entry.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {entry.value}{" "}
            {entry.name === "Power"
              ? "W"
              : entry.name === "Voltage"
                ? "V"
                : "°C"}
          </span>
        </p>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [usageRange, setUsageRange] = useState<string>("24h");
  const [energyRange, setEnergyRange] = useState<string>("24h");

  const { data: live } = useLiveReading();
  const { data: usageHistory = [] } = useReadingHistory(usageRange as any);
  const { data: energyHistory = [] } = useReadingHistory(energyRange as any);

  return (
    <div className="space-y-6 font-sans">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="AC Voltage"
          value={live?.acVoltage?.toFixed(1) ?? "—"}
          unit="V"
          icon={Zap}
          iconColor="text-amber-500 dark:text-amber-400"
        />
        <StatCard
          label="AC Current"
          value={live?.acCurrent?.toFixed(2) ?? "—"}
          unit="A"
          icon={Activity}
          iconColor="text-cyan-500 dark:text-cyan-400"
        />
        <StatCard
          label="AC Power"
          value={live?.acPower?.toFixed(0) ?? "—"}
          unit="W"
          icon={Gauge}
          iconColor="text-violet-500 dark:text-violet-400"
        />
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <ChartCard
          title="Power Usage Analytics"
          action={
            <RangeSelect
              options={RANGE_OPTIONS}
              value={usageRange}
              onChange={setUsageRange}
            />
          }
        >
          {usageHistory.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usageHistory} barCategoryGap="20%">
                <CartesianGrid
                  vertical={false}
                  stroke="#E5E7EB"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="timestamp"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => formatTick(v, usageRange)}
                />
                <YAxis
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  content={<BarTooltip range={usageRange} />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Bar
                  dataKey="power"
                  radius={[6, 6, 0, 0]}
                  fill="#93C5FD"
                  activeBar={{ fill: "#3B82F6" }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Power Quality">
          <div className="space-y-4 mt-1">
            <div>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                {live?.powerQualityScore?.toFixed(0) ?? "—"}
                <span className="text-base text-gray-900 dark:text-white">
                  /100
                </span>
              </p>
              <p className="text-xs text-gray-900 dark:text-white mt-0.5 font-medium">
                Composite quality score
              </p>
            </div>
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 dark:text-white font-medium">
                  cos φ
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {live?.cosPhi?.toFixed(2) ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 dark:text-white font-medium">
                  Frequency
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {live?.frequency?.toFixed(1) ?? "—"} Hz
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 dark:text-white font-medium">
                  Current per kW
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  — A/kW
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900 dark:text-white font-medium">
                  Energy Cost
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  —
                </span>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <ChartCard
          title="Energy Consumption"
          action={
            <RangeSelect
              options={RANGE_OPTIONS}
              value={energyRange}
              onChange={setEnergyRange}
            />
          }
        >
          {energyHistory.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-900 dark:text-white">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={energyHistory}>
                <CartesianGrid
                  vertical={false}
                  stroke="#E5E7EB"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="timestamp"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => formatTick(v, energyRange)}
                />
                <YAxis
                  yAxisId="left"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<DualAxisTooltip range={energyRange} />} />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="power"
                  stroke="#60A5FA"
                  strokeWidth={2.5}
                  dot={false}
                  name="Power"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="voltage"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  dot={false}
                  name="Voltage"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="Temperature">
            <div className="flex items-center gap-4">
              <Thermometer size={20} className="text-rose-500 shrink-0" />
              <div>
                <span className="text-[26px] font-semibold text-gray-900 dark:text-white tabular-nums leading-none transition-all duration-300">
                  {live?.temperature?.toFixed(1) ?? "—"}
                  <span className="text-base font-semibold text-gray-900 dark:text-white ml-1">
                    °C
                  </span>
                </span>
              </div>
            </div>
          </ChartCard>
          <ChartCard title="Humidity">
            <div className="flex items-center gap-4">
              <Droplets size={20} className="text-blue-500 shrink-0" />
              <div>
                <span className="text-[26px] font-semibold text-gray-900 dark:text-white tabular-nums leading-none transition-all duration-300">
                  {live?.humidity?.toFixed(0) ?? "—"}
                  <span className="text-base font-semibold text-gray-900 dark:text-white ml-1">
                    %
                  </span>
                </span>
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
