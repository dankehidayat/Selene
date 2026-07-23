// apps/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import {
  Zap,
  Activity,
  Gauge,
  Thermometer,
  Droplets,
  DollarSign,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ChartCard, RangeSelect } from "@/components/ChartCard";
import {
  useLiveReading,
  useReadingHistory,
  useAnalyticsSummary,
} from "@/services/api";
import { useAuth } from "@/services/auth";

const RANGE_OPTIONS = ["1h", "24h", "7d", "30d", "3m", "6m", "1y"] as const;

function formatDateForTooltip(iso: string, range: string): string {
  const d = new Date(iso);
  switch (range) {
    case "1h":
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
      return d.toLocaleDateString([], { month: "short", year: "numeric" });
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
      return d.toLocaleDateString([], { weekday: "short" });
    case "30d":
    case "3m":
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    case "6m":
    case "1y":
      return d.toLocaleDateString([], { month: "short" });
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

function UnifiedTooltip({
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
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {entry.value}{" "}
            {entry.name === "Power"
              ? "W"
              : entry.name === "Current"
                ? "A"
                : entry.name === "Temperature"
                  ? "°C"
                  : "%"}
          </span>
        </p>
      ))}
    </div>
  );
}

function ClimateTooltip({
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
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {entry.value} {entry.name === "Temperature" ? "°C" : "%"}
          </span>
        </p>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getGreetingMessage(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Start your day with insights into your energy usage.";
  if (hour < 17)
    return "Monitor your power consumption and environmental conditions.";
  return "Review today's energy patterns and plan for tomorrow.";
}

export function Dashboard() {
  const [chartRange, setChartRange] = useState<string>("24h");
  const { user } = useAuth();
  const { data: live } = useLiveReading();
  const { data: history = [] } = useReadingHistory(chartRange as any);
  const { data: summary } = useAnalyticsSummary("24h");

  const estimatedCost = summary?.energy?.estimatedCost ?? "—";
  const totalKwh = summary?.energy?.totalKwh ?? "—";

  const climateHistory = history.map((h: any) => ({
    timestamp: h.timestamp,
    temperature: h.temperature,
    humidity: h.humidity,
  }));

  return (
    <div className="space-y-8 font-sans">
      {/* Greeting */}
      <div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {getGreeting()}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {getGreetingMessage()}
        </p>
      </div>

      {/* Energy Section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
          Energy
        </p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <StatCard
            label="AC Voltage"
            value={live?.acVoltage?.toFixed(1) ?? "—"}
            unit="V"
            icon={Zap}
            iconColor="text-amber-500 dark:text-amber-400"
          />
          <StatCard
            label="AC Current"
            value={live?.acCurrent?.toFixed(3) ?? "—"}
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
          <StatCard
            label="Est. Cost (24h)"
            value={estimatedCost}
            icon={DollarSign}
            iconColor="text-emerald-500 dark:text-emerald-400"
            sub={totalKwh !== "—" ? `${totalKwh} kWh` : undefined}
            subTone="text-gray-500 dark:text-gray-400"
          />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <ChartCard
            title="Energy Usage"
            chartId="chart-energy-usage"
            action={
              <RangeSelect
                options={RANGE_OPTIONS}
                value={chartRange}
                onChange={setChartRange}
              />
            }
          >
            {history.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={history}>
                  <defs>
                    <linearGradient
                      id="powerGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="currentGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#F59E0B"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={(v: string) => formatTick(v, chartRange)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={CHART_FONT}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={CHART_FONT}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip content={<UnifiedTooltip range={chartRange} />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 11,
                      fontFamily: "Inter, sans-serif",
                    }}
                    formatter={(value: string) => (
                      <span className="text-gray-600 dark:text-gray-300">
                        {value}
                      </span>
                    )}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="power"
                    fill="url(#powerGradient)"
                    stroke="none"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="power"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#3B82F6" }}
                    name="Power (W)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="current"
                    fill="url(#currentGradient)"
                    stroke="none"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="current"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#F59E0B" }}
                    name="Current (A)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Power Quality">
            <div className="space-y-4 mt-1">
              <div>
                <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                  {live?.powerQualityScore?.toFixed(0) ?? "—"}
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
                  <span className="text-gray-500 dark:text-gray-400">
                    cos φ
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {live?.cosPhi?.toFixed(2) ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Frequency
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {live?.frequency?.toFixed(1) ?? "—"} Hz
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
          </ChartCard>
        </div>
      </div>

      {/* Environment Section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
          Environment
        </p>
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <ChartCard title="Temperature">
            <div className="flex items-center gap-3 mb-4">
              <Thermometer size={18} className="text-rose-500 shrink-0" />
              <div>
                <span className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
                  {live?.temperature?.toFixed(1) ?? "—"}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-0.5">
                    °C
                  </span>
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {live?.tempComfort
                    ? `Feels ${live.tempComfort.toLowerCase()}`
                    : "—"}
                </p>
              </div>
            </div>
          </ChartCard>
          <ChartCard title="Humidity">
            <div className="flex items-center gap-3 mb-4">
              <Droplets size={18} className="text-blue-500 shrink-0" />
              <div>
                <span className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums">
                  {live?.humidity?.toFixed(0) ?? "—"}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white ml-0.5">
                    %
                  </span>
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {live?.humidity !== undefined
                    ? live.humidity > 70
                      ? "High humidity"
                      : live.humidity < 40
                        ? "Low humidity"
                        : "Normal range"
                    : "—"}
                </p>
              </div>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Temperature & Humidity"
          chartId="chart-climate"
          action={
            <RangeSelect
              options={RANGE_OPTIONS}
              value={chartRange}
              onChange={setChartRange}
            />
          }
        >
          {climateHistory.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={climateHistory}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="humidGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(v: string) => formatTick(v, chartRange)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={CHART_FONT}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ClimateTooltip range={chartRange} />} />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    fontFamily: "Inter, sans-serif",
                  }}
                  formatter={(value: string) => (
                    <span className="text-gray-600 dark:text-gray-300">
                      {value}
                    </span>
                  )}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  fill="url(#tempGradient)"
                  stroke="none"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#EF4444" }}
                  name="Temperature (°C)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  fill="url(#humidGradient)"
                  stroke="none"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3B82F6" }}
                  name="Humidity (%)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
