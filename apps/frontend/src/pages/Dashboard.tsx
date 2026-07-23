// apps/frontend/src/pages/Dashboard.tsx
import { useState } from "react";
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from "recharts";
import { Zap, Activity, Gauge, DollarSign } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ChartCard, RangeSelect } from "@/components/ChartCard";
import { PowerOverview } from "@/components/PowerOverview";
import { ClimateOverview } from "@/components/ClimateOverview";
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
            {entry.value} W
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
            {entry.value}
            {entry.name === "Temperature" ? "°C" : "%"}
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
            title="Power Usage Past History"
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
                    payload={[
                      {
                        value: "Power (W)",
                        type: "line",
                        color: "#3B82F6",
                        id: "power",
                      },
                      {
                        value: "Current (A)",
                        type: "line",
                        color: "#F59E0B",
                        id: "current",
                      },
                    ]}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="power"
                    fill="url(#powerGradient)"
                    stroke="none"
                    hide
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
                    hide
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

          <ChartCard title="Power Overview">
            <PowerOverview
              qualityScore={live?.powerQualityScore}
              cosPhi={live?.cosPhi}
              frequency={live?.frequency}
              estimatedCost={estimatedCost}
              totalKwh={totalKwh}
            />
          </ChartCard>
        </div>
      </div>

      {/* Environment Section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
          Environment
        </p>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <ChartCard
            title="Climate Past History"
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
                    <linearGradient
                      id="tempGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#EF4444"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="humidGradient"
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
                    payload={[
                      {
                        value: "Temperature (°C)",
                        type: "line",
                        color: "#EF4444",
                        id: "temperature",
                      },
                      {
                        value: "Humidity (%)",
                        type: "line",
                        color: "#3B82F6",
                        id: "humidity",
                      },
                    ]}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    fill="url(#tempGradient)"
                    stroke="none"
                    hide
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
                    hide
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

          <ChartCard title="Climate Overview">
            <ClimateOverview
              temperature={live?.temperature}
              humidity={live?.humidity}
              comfort={live?.tempComfort}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
