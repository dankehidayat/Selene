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
  ReferenceLine,
} from "recharts";
import { Zap, Activity, Gauge, DollarSign, Info } from "lucide-react";
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
import { ensembleForecast, confidenceBands } from "@/lib/forecast";

const RANGE_OPTIONS = ["1h", "24h", "7d", "30d", "3m", "6m", "1y"] as const;
const RANGE_LABELS: Record<string, string> = {
  "1h": "1 Hour",
  "24h": "24 Hours",
  "7d": "7 Days",
  "30d": "30 Days",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

function formatDateForTooltip(iso: string, range: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isFuture = d > now;
  const prefix = isFuture ? "Predicted · " : "";
  switch (range) {
    case "1h":
      return (
        prefix +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    case "24h":
      return (
        prefix +
        d.toLocaleDateString([], { weekday: "short" }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    case "7d":
      return (
        prefix +
        d.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    case "30d":
    case "3m":
      return (
        prefix + d.toLocaleDateString([], { month: "short", day: "numeric" })
      );
    case "6m":
    case "1y":
      return (
        prefix + d.toLocaleDateString([], { month: "short", year: "numeric" })
      );
    default:
      return prefix + d.toLocaleString();
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

const CF = { fontSize: 11, fontFamily: "Inter, sans-serif", fill: "#9CA3AF" };
const TC =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans";

function ForecastBanner() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-[11px] text-blue-600 dark:text-blue-300 w-fit">
      <Info size={12} className="shrink-0" />
      <span>Dashed = predicted. Solid = actual readings.</span>
    </div>
  );
}

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
    <div className={TC}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {payload.map((e) => (
        <p
          key={e.name}
          className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: e.color }}
          />
          {e.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {e.value} W
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
    <div className={TC}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {payload.map((e) => (
        <p
          key={e.name}
          className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: e.color }}
          />
          {e.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {e.value}
            {e.name?.includes("Temp") ? "°C" : "%"}
          </span>
        </p>
      ))}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function getGreetingMessage(): string {
  const h = new Date().getHours();
  if (h < 12) return "Start your day with insights into your energy usage.";
  if (h < 17)
    return "Monitor your power consumption and environmental conditions.";
  return "Review today's energy patterns and plan for tomorrow.";
}

export function Dashboard() {
  const [chartRange, setChartRange] = useState<string>("24h");
  const [showForecast, setShowForecast] = useState(false);
  const { user } = useAuth();

  // ── SSE Live Data ────────────────────────────────────
  const { data: live } = useLiveReading();

  const { data: history = [] } = useReadingHistory(chartRange as any);
  const { data: summary } = useAnalyticsSummary("24h");
  const ec = summary?.energy?.estimatedCost ?? "—";
  const tk = summary?.energy?.totalKwh ?? "—";
  const ch = history.map((h: any) => ({
    timestamp: h.timestamp,
    temperature: h.temperature,
    humidity: h.humidity,
  }));

  const pf = showForecast
    ? ensembleForecast(
        history.map((h: any) => ({ timestamp: h.timestamp, value: h.power })),
        chartRange,
      )
    : { forecast: [], confidence: 0 };
  const cfc = showForecast
    ? ensembleForecast(
        history.map((h: any) => ({ timestamp: h.timestamp, value: h.current })),
        chartRange,
      )
    : { forecast: [], confidence: 0 };
  const tf = showForecast
    ? ensembleForecast(
        ch.map((h: any) => ({ timestamp: h.timestamp, value: h.temperature })),
        chartRange,
      )
    : { forecast: [], confidence: 0 };
  const hf = showForecast
    ? ensembleForecast(
        ch.map((h: any) => ({ timestamp: h.timestamp, value: h.humidity })),
        chartRange,
      )
    : { forecast: [], confidence: 0 };

  const pb = pf.forecast.length
    ? confidenceBands(pf.forecast)
    : { upper: [], lower: [] };
  const cb = cfc.forecast.length
    ? confidenceBands(cfc.forecast)
    : { upper: [], lower: [] };
  const tb = tf.forecast.length
    ? confidenceBands(tf.forecast)
    : { upper: [], lower: [] };
  const hb = hf.forecast.length
    ? confidenceBands(hf.forecast)
    : { upper: [], lower: [] };

  const avgConf =
    pf.confidence + cfc.confidence + tf.confidence + hf.confidence;
  const showConf = showForecast && avgConf > 0;
  const now = new Date().toISOString();

  return (
    <div className="space-y-8 font-sans">
      <div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {getGreeting()}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {getGreetingMessage()}
        </p>
      </div>

      {/* Energy */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Energy
          </p>
          <div className="flex items-center gap-2">
            {showConf && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                {Math.round((avgConf / 4) * 100)}% confidence
              </span>
            )}
            <button
              onClick={() => setShowForecast(!showForecast)}
              className={`text-xs font-medium px-2 py-1 rounded-lg border transition ${showForecast ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            >
              Forecast
            </button>
          </div>
        </div>
        {showForecast && (
          <div className="mb-3">
            <ForecastBanner />
          </div>
        )}
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
            value={ec}
            icon={DollarSign}
            iconColor="text-emerald-500 dark:text-emerald-400"
            sub={tk !== "—" ? `${tk} kWh` : undefined}
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
                labels={RANGE_LABELS}
              />
            }
          >
            {history.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={history}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#F59E0B"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pfb" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.06}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cfb" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#F59E0B"
                        stopOpacity={0.06}
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
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => formatTick(v, chartRange)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={CF}
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
                        type: "line" as const,
                        color: "#3B82F6",
                        id: "p",
                      },
                      {
                        value: "Current (A)",
                        type: "line" as const,
                        color: "#F59E0B",
                        id: "c",
                      },
                      ...(pf.forecast.length
                        ? [
                            {
                              value: "P. Forecast",
                              type: "line" as const,
                              color: "#3B82F6",
                              id: "pf",
                            },
                          ]
                        : []),
                      ...(cfc.forecast.length
                        ? [
                            {
                              value: "C. Forecast",
                              type: "line" as const,
                              color: "#F59E0B",
                              id: "cf",
                            },
                          ]
                        : []),
                    ]}
                  />
                  {pf.forecast.length > 0 && (
                    <ReferenceLine
                      x={now}
                      yAxisId="left"
                      stroke="#9CA3AF"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                      label={{
                        value: "Now",
                        position: "top",
                        fill: "#9CA3AF",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="power"
                    fill="url(#pg)"
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
                    fill="url(#cg)"
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
                  {pb.upper.length > 0 && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      data={pb.upper}
                      dataKey="value"
                      stroke="none"
                      fill="url(#pfb)"
                      hide
                    />
                  )}
                  {pf.forecast.length > 0 && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      data={pf.forecast}
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      strokeDasharray="6,4"
                      dot={false}
                      name="P. Forecast"
                      connectNulls
                    />
                  )}
                  {cb.upper.length > 0 && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      data={cb.upper}
                      dataKey="value"
                      stroke="none"
                      fill="url(#cfb)"
                      hide
                    />
                  )}
                  {cfc.forecast.length > 0 && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      data={cfc.forecast}
                      dataKey="value"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="6,4"
                      dot={false}
                      name="C. Forecast"
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Power Overview">
            <PowerOverview
              qualityScore={live?.powerQualityScore}
              cosPhi={live?.cosPhi}
              frequency={live?.frequency}
              estimatedCost={ec}
              totalKwh={tk}
            />
          </ChartCard>
        </div>
      </div>

      {/* Environment */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Environment
          </p>
          <div className="flex items-center gap-2">
            {showConf && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                {Math.round((avgConf / 4) * 100)}% confidence
              </span>
            )}
            <button
              onClick={() => setShowForecast(!showForecast)}
              className={`text-xs font-medium px-2 py-1 rounded-lg border transition ${showForecast ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            >
              Forecast
            </button>
          </div>
        </div>
        {showForecast && (
          <div className="mb-3">
            <ForecastBanner />
          </div>
        )}
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <ChartCard
            title="Climate History"
            chartId="chart-climate"
            action={
              <RangeSelect
                options={RANGE_OPTIONS}
                value={chartRange}
                onChange={setChartRange}
                labels={RANGE_LABELS}
              />
            }
          >
            {ch.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={ch}>
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#EF4444"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tfb" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#EF4444"
                        stopOpacity={0.06}
                      />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hfb" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.06}
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
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => formatTick(v, chartRange)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={CF}
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
                        type: "line" as const,
                        color: "#EF4444",
                        id: "t",
                      },
                      {
                        value: "Humidity (%)",
                        type: "line" as const,
                        color: "#3B82F6",
                        id: "h",
                      },
                    ]}
                  />
                  {tf.forecast.length > 0 && (
                    <ReferenceLine
                      x={now}
                      yAxisId="left"
                      stroke="#9CA3AF"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                      label={{
                        value: "Now",
                        position: "top",
                        fill: "#9CA3AF",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    fill="url(#tg)"
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
                    fill="url(#hg)"
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
                  {tb.upper.length > 0 && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      data={tb.upper}
                      dataKey="value"
                      stroke="none"
                      fill="url(#tfb)"
                      hide
                    />
                  )}
                  {tf.forecast.length > 0 && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      data={tf.forecast}
                      dataKey="value"
                      stroke="#EF4444"
                      strokeWidth={2}
                      strokeDasharray="6,4"
                      dot={false}
                      name="T. Forecast"
                      connectNulls
                    />
                  )}
                  {hb.upper.length > 0 && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      data={hb.upper}
                      dataKey="value"
                      stroke="none"
                      fill="url(#hfb)"
                      hide
                    />
                  )}
                  {hf.forecast.length > 0 && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      data={hf.forecast}
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      strokeDasharray="6,4"
                      dot={false}
                      name="H. Forecast"
                      connectNulls
                    />
                  )}
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
