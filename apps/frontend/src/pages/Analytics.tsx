// [apps/frontend] src/pages/Analytics.tsx
import { useState, useRef, useEffect } from "react";
import * as Plot from "@observablehq/plot";
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
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Zap,
  Activity,
  DollarSign,
  BarChart3,
  Thermometer,
  Droplets,
  TrendingUp,
  Gauge,
  PieChartIcon,
} from "lucide-react";
import { ChartCard, RangeSelect } from "@/components/ChartCard";
import { StatCard } from "@/components/StatCard";
import {
  useAnalyticsSummary,
  useReadingHistory,
  useClimateSummary,
  useFuzzyDistribution,
  useMembershipData,
  useDecisionSurface,
} from "@/services/api";

const RANGE_OPTIONS = ["1h", "24h", "7d", "30d", "3m", "6m", "1y"] as const;

const FUZZY_COLORS: Record<string, string> = {
  ECONOMICAL: "#2ecc71",
  NORMAL: "#3498db",
  WASTEFUL: "#e74c3c",
};
const COMFORT_COLORS: Record<string, string> = {
  COLD: "#3B82F6",
  COOL: "#06B6D4",
  COMFORTABLE: "#10B981",
  WARM: "#F59E0B",
  HOT: "#EF4444",
};

const CHART_FONT = {
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
  fill: "#9CA3AF",
};
const TOOLTIP_CLASS =
  "bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans";
const PLOT_STYLE = {
  fontFamily: "Inter, sans-serif",
  fontSize: "11px",
  color: "#6B7280",
  background: "transparent",
};

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

interface TooltipBase {
  active?: boolean;
  payload?: any[];
  label?: string;
}
function BarTooltip({
  active,
  payload,
  label,
  range,
}: TooltipBase & { range: string }) {
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
          {payload[0]?.value ?? 0} W
        </span>
      </p>
    </div>
  );
}
function PeakTooltip({ active, payload, label }: TooltipBase) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        Hour:{" "}
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {label}
        </span>
      </p>
      <p className="text-gray-400 dark:text-gray-400">
        Avg Power:{" "}
        <span className="text-gray-900 dark:text-white font-semibold">
          {payload[0]?.value ?? 0} W
        </span>
      </p>
    </div>
  );
}
function HourTooltip({ active, payload, label }: TooltipBase) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        Hour:{" "}
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {label}
        </span>
      </p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-gray-400 dark:text-gray-400">
          {entry.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {entry.value ?? 0} {entry.name?.includes("Temp") ? "°C" : "%"}
          </span>
        </p>
      ))}
    </div>
  );
}
function ComfortTooltip({ active, payload, label }: TooltipBase) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        Status:{" "}
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {label}
        </span>
      </p>
      <p className="text-gray-400 dark:text-gray-400">
        Percentage:{" "}
        <span className="text-gray-900 dark:text-white font-semibold">
          {payload[0]?.value ?? 0}%
        </span>
      </p>
    </div>
  );
}
function PieTooltip({
  active,
  payload,
  total,
}: TooltipBase & { total: number }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400">
        {payload[0]?.name ?? "—"}:{" "}
        <span className="text-gray-900 dark:text-white font-semibold">
          {val} ({pct}%)
        </span>
      </p>
    </div>
  );
}

function ObsScatter({
  data,
}: {
  data: Array<{ power: number; powerFactor: number; category: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    ref.current.innerHTML = "";
    const plot = Plot.plot({
      width: 500,
      height: 350,
      marginLeft: 50,
      marginBottom: 35,
      style: PLOT_STYLE,
      color: {
        legend: true,
        domain: ["ECONOMICAL", "NORMAL", "WASTEFUL"],
        range: [
          FUZZY_COLORS.ECONOMICAL,
          FUZZY_COLORS.NORMAL,
          FUZZY_COLORS.WASTEFUL,
        ],
      },
      x: { label: "Power (W)" },
      y: { label: "Power Factor", domain: [0, 1] },
      marks: [
        Plot.dot(data, {
          x: "power",
          y: "powerFactor",
          fill: "category",
          r: 5,
          opacity: 0.7,
          stroke: "#1E293B",
          strokeWidth: 0.5,
        }),
        Plot.ruleY([0.85], {
          stroke: "#3B82F6",
          strokeWidth: 2,
          strokeDasharray: "6,3",
        }),
        Plot.ruleY([0.6], {
          stroke: "#F59E0B",
          strokeWidth: 1.5,
          strokeDasharray: "3,3",
        }),
      ],
    });
    ref.current.appendChild(plot);
  }, [data]);
  return <div ref={ref} className="flex justify-center overflow-visible" />;
}

function ObsBoxPlot({
  data,
}: {
  data: Array<{ power: number; category: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    ref.current.innerHTML = "";
    const plot = Plot.plot({
      width: 500,
      height: 250,
      marginLeft: 90,
      marginBottom: 35,
      style: PLOT_STYLE,
      x: { label: "Power (W)", grid: true },
      y: { label: null, domain: ["ECONOMICAL", "NORMAL", "WASTEFUL"] },
      marks: [
        Plot.boxX(data, {
          x: "power",
          y: "category",
          fill: (d: any) => FUZZY_COLORS[d.category] || "#6366F1",
          fillOpacity: 0.4,
          stroke: "#1E293B",
          strokeWidth: 1.5,
        }),
      ],
    });
    ref.current.appendChild(plot);
  }, [data]);
  return <div ref={ref} className="flex justify-center overflow-visible" />;
}

function ObsBlandAltman({
  data,
  meanDiff,
  upperLoA,
  lowerLoA,
}: {
  data: Array<{ mean: number; difference: number }>;
  meanDiff: number;
  upperLoA: number;
  lowerLoA: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const plot = Plot.plot({
      width: 500,
      height: 280,
      marginLeft: 45,
      marginBottom: 35,
      style: PLOT_STYLE,
      x: {
        label: "Mean (Fuzzy + Threshold) / 2",
        domain: [0.5, 3.5],
        ticks: 3,
      },
      y: { label: "Difference", grid: true },
      marks: [
        Plot.dot(data, {
          x: "mean",
          y: "difference",
          fill: "#6366F1",
          fillOpacity: 0.6,
          r: 4,
        }),
        Plot.ruleY([meanDiff], {
          stroke: "#EF4444",
          strokeWidth: 2,
          strokeDasharray: "6,3",
        }),
        Plot.ruleY([upperLoA], {
          stroke: "#F59E0B",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
        }),
        Plot.ruleY([lowerLoA], {
          stroke: "#F59E0B",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
        }),
      ],
    });
    ref.current.appendChild(plot);
  }, [data, meanDiff, upperLoA, lowerLoA]);
  return (
    <div>
      <div ref={ref} className="flex justify-center overflow-visible" />
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-900 dark:text-white font-sans font-medium">
        <span>
          Mean Diff: <strong>{meanDiff.toFixed(3)}</strong>
        </span>
        <span>
          Upper LoA: <strong>{upperLoA.toFixed(3)}</strong>
        </span>
        <span>
          Lower LoA: <strong>{lowerLoA.toFixed(3)}</strong>
        </span>
      </div>
    </div>
  );
}

function ObsDecisionSurface({
  surface,
  actual,
}: {
  surface: Array<{ power: number; pf: number; category: string }>;
  actual: Array<{ power: number; powerFactor: number; category: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const plot = Plot.plot({
      width: 500,
      height: 350,
      marginLeft: 55,
      marginBottom: 35,
      style: PLOT_STYLE,
      color: {
        legend: true,
        domain: ["ECONOMICAL", "NORMAL", "WASTEFUL"],
        range: [
          FUZZY_COLORS.ECONOMICAL,
          FUZZY_COLORS.NORMAL,
          FUZZY_COLORS.WASTEFUL,
        ],
      },
      x: { label: "Power (W)", domain: [0, 120] },
      y: { label: "Power Factor", domain: [0.3, 1.0] },
      marks: [
        Plot.dot(surface, {
          x: "power",
          y: "pf",
          fill: "category",
          r: 5,
          opacity: 0.5,
          symbol: "square",
        }),
        Plot.dot(actual, {
          x: "power",
          y: "powerFactor",
          fill: "category",
          r: 4,
          opacity: 0.9,
          stroke: "#1E293B",
          strokeWidth: 0.5,
        }),
        Plot.ruleY([0.85], {
          stroke: "#3B82F6",
          strokeWidth: 2,
          strokeDasharray: "6,3",
        }),
        Plot.ruleY([0.6], {
          stroke: "#F59E0B",
          strokeWidth: 1.5,
          strokeDasharray: "3,3",
        }),
        Plot.ruleX([30], {
          stroke: "#2ecc71",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.6,
        }),
        Plot.ruleX([70], {
          stroke: "#e74c3c",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.6,
        }),
      ],
    });
    ref.current.appendChild(plot);
  }, [surface, actual]);
  return <div ref={ref} className="flex justify-center overflow-visible" />;
}

function StatRow({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm font-sans">
      <span className="text-gray-900 dark:text-white font-medium">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">
        {value ?? "—"}
      </span>
    </div>
  );
}

export function Analytics() {
  const [energyRange, setEnergyRange] = useState<string>("7d");
  const [climateRange, setClimateRange] = useState<string>("7d");
  const [activeTab, setActiveTab] = useState<
    "energy" | "environment" | "fuzzy"
  >("energy");

  const { data: summary } = useAnalyticsSummary(energyRange as any);
  const { data: history = [] } = useReadingHistory(energyRange as any);
  const { data: climate } = useClimateSummary(climateRange as any);
  const { data: fuzzy } = useFuzzyDistribution(energyRange);
  const { data: membership } = useMembershipData();
  const { data: decisionSurface } = useDecisionSurface();

  const peakData =
    summary?.peakHours?.map((p: any) => ({
      name: `${p.hour}:00`,
      power: p.avgPower,
    })) ?? [];
  const comfortData = climate?.comfortDistribution ?? [];
  const hourlyClimate = climate?.hourlyData ?? [];

  const pieData = fuzzy
    ? [
        { name: "ECONOMICAL", value: fuzzy.distribution?.ECONOMICAL ?? 0 },
        { name: "NORMAL", value: fuzzy.distribution?.NORMAL ?? 0 },
        { name: "WASTEFUL", value: fuzzy.distribution?.WASTEFUL ?? 0 },
      ].filter((d) => d.value > 0)
    : [];

  const blandAltmanData = fuzzy?.results
    ? (() => {
        const points = fuzzy.results.map((d: any) => {
          const fuzzyScore =
            d.category === "ECONOMICAL" ? 1 : d.category === "NORMAL" ? 2 : 3;
          const thresholdScore = d.power <= 30 ? 1 : d.power <= 70 ? 2 : 3;
          return {
            mean: (fuzzyScore + thresholdScore) / 2,
            difference: fuzzyScore - thresholdScore,
          };
        });
        const diffs = points.map((p) => p.difference);
        const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const stdDiff = Math.sqrt(
          diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / diffs.length,
        );
        return {
          data: points,
          meanDiff: +meanDiff.toFixed(3),
          upperLoA: +(meanDiff + 1.96 * stdDiff).toFixed(3),
          lowerLoA: +(meanDiff - 1.96 * stdDiff).toFixed(3),
        };
      })()
    : null;

  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(["energy", "environment", "fuzzy"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition font-sans ${activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"}`}
          >
            {tab === "energy"
              ? "Energy"
              : tab === "environment"
                ? "Environment"
                : "Fuzzy Analysis"}
          </button>
        ))}
      </div>

      {activeTab === "energy" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Energy Analysis & Insights
              </h2>
              <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
                Comprehensive power consumption analytics and statistical
                summaries
              </p>
            </div>
            <RangeSelect
              options={RANGE_OPTIONS}
              value={energyRange}
              onChange={setEnergyRange}
            />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Avg Power"
              value={summary?.power?.average ?? "—"}
              unit="W"
              icon={Zap}
              iconColor="text-amber-500 dark:text-amber-400"
            />
            <StatCard
              label="Total Energy"
              value={summary?.energy?.totalKwh ?? "—"}
              unit="kWh"
              icon={Activity}
              iconColor="text-cyan-500 dark:text-cyan-400"
            />
            <StatCard
              label="Est. Cost"
              value={summary?.energy?.estimatedCost ?? "—"}
              icon={DollarSign}
              iconColor="text-emerald-500 dark:text-emerald-400"
            />
            <StatCard
              label="Data Points"
              value={summary?.dataPoints ?? "—"}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Power Distribution" chartId="chart-power-dist">
              {history.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={history}>
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
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      content={<BarTooltip range={energyRange} />}
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
            <ChartCard title="Peak Usage Hours" chartId="chart-peak-hours">
              {peakData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={peakData} layout="vertical">
                    <CartesianGrid
                      horizontal={false}
                      stroke="#E5E7EB"
                      strokeOpacity={0.3}
                    />
                    <XAxis
                      type="number"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip
                      content={<PeakTooltip />}
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    />
                    <Bar
                      dataKey="power"
                      radius={[0, 6, 6, 0]}
                      fill="#F59E0B"
                      activeBar={{ fill: "#D97706" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <ChartCard title="Power Statistics">
              <div className="space-y-3">
                <StatRow
                  label="Mean (μ)"
                  value={`${summary?.power?.average} W`}
                />
                <StatRow label="Median" value={`${summary?.power?.median} W`} />
                <StatRow
                  label="Std Deviation (σ)"
                  value={`±${summary?.power?.stdDeviation} W`}
                />
                <StatRow label="Minimum" value={`${summary?.power?.min} W`} />
                <StatRow label="Maximum" value={`${summary?.power?.max} W`} />
              </div>
            </ChartCard>
            <ChartCard title="Power Quality">
              <div className="space-y-3">
                <StatRow
                  label="Avg Voltage"
                  value={`${summary?.voltage?.average} V`}
                />
                <StatRow
                  label="Avg cos φ"
                  value={`${summary?.powerFactor?.average}`}
                />
                <StatRow
                  label="Avg Reactive Power"
                  value={`${summary?.reactivePower?.average} VAR`}
                />
                <StatRow
                  label="Reactive/Active Ratio"
                  value={`${summary?.reactivePower?.ratio}`}
                />
              </div>
            </ChartCard>
            <ChartCard title="Energy Summary">
              <div className="space-y-3">
                <StatRow
                  label="Total Consumption"
                  value={`${summary?.energy?.totalKwh} kWh`}
                />
                <StatRow
                  label="Estimated Cost"
                  value={summary?.energy?.estimatedCost ?? "—"}
                />
                <StatRow
                  label="Sample Size"
                  value={`${summary?.dataPoints} readings`}
                />
                <StatRow
                  label="Period"
                  value={
                    summary
                      ? `${new Date(summary.timeSpan.from).toLocaleDateString()} – ${new Date(summary.timeSpan.to).toLocaleDateString()}`
                      : "—"
                  }
                />
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {activeTab === "environment" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Environment Analysis & Insights
              </h2>
              <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
                Comprehensive temperature, humidity, and climate comfort
                analytics
              </p>
            </div>
            <RangeSelect
              options={RANGE_OPTIONS}
              value={climateRange}
              onChange={setClimateRange}
            />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Avg Temp"
              value={climate?.temperature?.average ?? "—"}
              unit="°C"
              icon={Thermometer}
              iconColor="text-rose-500 dark:text-rose-400"
            />
            <StatCard
              label="Avg Humidity"
              value={climate?.humidity?.average ?? "—"}
              unit="%"
              icon={Droplets}
              iconColor="text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Dew Point"
              value={climate?.dewPoint?.average ?? "—"}
              unit="°C"
              icon={Gauge}
              iconColor="text-cyan-500 dark:text-cyan-400"
            />
            <StatCard
              label="Correlation"
              value={climate?.correlation?.tempHumidity ?? "—"}
              icon={TrendingUp}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Hourly Climate Pattern"
              chartId="chart-hourly-climate"
            >
              {hourlyClimate.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={hourlyClimate}>
                    <CartesianGrid
                      vertical={false}
                      stroke="#E5E7EB"
                      strokeOpacity={0.3}
                    />
                    <XAxis
                      dataKey="hour"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}:00`}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip content={<HourTooltip />} />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temperature"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                      name="Temperature (°C)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="humidity"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      name="Humidity (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title="Comfort Distribution"
              chartId="chart-comfort-dist"
            >
              {comfortData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={comfortData}>
                    <CartesianGrid
                      vertical={false}
                      stroke="#E5E7EB"
                      strokeOpacity={0.3}
                    />
                    <XAxis
                      dataKey="status"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      content={<ComfortTooltip />}
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    />
                    <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                      {comfortData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COMFORT_COLORS[entry.status] || "#6B7280"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Temperature Statistics">
              <div className="space-y-3">
                <StatRow
                  label="Mean (μ)"
                  value={`${climate?.temperature?.average} °C`}
                />
                <StatRow
                  label="Median"
                  value={`${climate?.temperature?.median} °C`}
                />
                <StatRow
                  label="Std Deviation (σ)"
                  value={`±${climate?.temperature?.stdDeviation} °C`}
                />
                <StatRow
                  label="Minimum"
                  value={`${climate?.temperature?.min} °C`}
                />
                <StatRow
                  label="Maximum"
                  value={`${climate?.temperature?.max} °C`}
                />
                <StatRow
                  label="Degree-Hours (>18°C)"
                  value={`${climate?.temperature?.degreeHours}`}
                />
              </div>
            </ChartCard>
            <ChartCard title="Humidity Statistics">
              <div className="space-y-3">
                <StatRow
                  label="Mean (μ)"
                  value={`${climate?.humidity?.average} %`}
                />
                <StatRow
                  label="Median"
                  value={`${climate?.humidity?.median} %`}
                />
                <StatRow
                  label="Std Deviation (σ)"
                  value={`±${climate?.humidity?.stdDeviation} %`}
                />
                <StatRow
                  label="Minimum"
                  value={`${climate?.humidity?.min} %`}
                />
                <StatRow
                  label="Maximum"
                  value={`${climate?.humidity?.max} %`}
                />
                <StatRow
                  label="Temp-Humidity Corr"
                  value={`${climate?.correlation?.tempHumidity}`}
                />
              </div>
            </ChartCard>
          </div>
        </section>
      )}

      {activeTab === "fuzzy" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Fuzzy Energy Analysis
              </h2>
              <p className="text-sm text-gray-900 dark:text-white mt-1 font-medium">
                Multi-variable fuzzy inference system for energy consumption
                classification
              </p>
            </div>
            <RangeSelect
              options={RANGE_OPTIONS}
              value={energyRange}
              onChange={setEnergyRange}
            />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Economical"
              value={fuzzy?.distribution?.ECONOMICAL ?? "—"}
              icon={PieChartIcon}
              iconColor="text-emerald-500 dark:text-emerald-400"
            />
            <StatCard
              label="Normal"
              value={fuzzy?.distribution?.NORMAL ?? "—"}
              icon={PieChartIcon}
              iconColor="text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Wasteful"
              value={fuzzy?.distribution?.WASTEFUL ?? "—"}
              icon={PieChartIcon}
              iconColor="text-red-500 dark:text-red-400"
            />
            <StatCard
              label="Total"
              value={fuzzy?.total ?? "—"}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Distribution of Energy Categories"
              chartId="chart-fuzzy-pie"
            >
              {pieData.length === 0 ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: "#9CA3AF", strokeWidth: 1 }}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={FUZZY_COLORS[entry.name] || "#6366F1"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<PieTooltip total={fuzzy?.total || 0} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title="Power vs Power Factor (Scatter)"
              chartId="chart-fuzzy-scatter"
            >
              {!fuzzy?.scatterData?.length ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  No data
                </div>
              ) : (
                <ObsScatter data={fuzzy.scatterData} />
              )}
            </ChartCard>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Voltage Membership Functions"
              chartId="chart-voltage-mf"
            >
              {!membership ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  Loading...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={membership.voltageMembership}>
                    <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                    <XAxis dataKey="x" tick={CHART_FONT} />
                    <YAxis domain={[0, 1]} tick={CHART_FONT} />
                    <Tooltip />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="low"
                      stroke="#EF4444"
                      strokeWidth={2}
                      dot={false}
                      name="Low"
                    />
                    <Line
                      type="monotone"
                      dataKey="normal"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={false}
                      name="Normal"
                    />
                    <Line
                      type="monotone"
                      dataKey="high"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                      name="High"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title="Power Membership Functions"
              chartId="chart-power-mf"
            >
              {!membership ? (
                <div className="flex h-[250px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                  Loading...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={membership.powerMembership}>
                    <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                    <XAxis dataKey="x" tick={CHART_FONT} />
                    <YAxis domain={[0, 1]} tick={CHART_FONT} />
                    <Tooltip />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="economical"
                      stroke="#2ecc71"
                      strokeWidth={2}
                      dot={false}
                      name="Economical"
                    />
                    <Line
                      type="monotone"
                      dataKey="normal"
                      stroke="#3498db"
                      strokeWidth={2}
                      dot={false}
                      name="Normal"
                    />
                    <Line
                      type="monotone"
                      dataKey="wasteful"
                      stroke="#e74c3c"
                      strokeWidth={2}
                      dot={false}
                      name="Wasteful"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <ChartCard
            title="Decision Surface (Power vs Power Factor)"
            chartId="chart-decision-surface"
          >
            {!decisionSurface || !fuzzy?.scatterData ? (
              <div className="flex h-[350px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                Loading...
              </div>
            ) : (
              <ObsDecisionSurface
                surface={decisionSurface}
                actual={fuzzy.scatterData}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Power Distribution by Category (Box Plot)"
            chartId="chart-box-plot"
          >
            {!fuzzy?.results?.length ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                No data
              </div>
            ) : (
              <ObsBoxPlot
                data={fuzzy.results.map((d: any) => ({
                  power: d.power,
                  category: d.category,
                }))}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Bland-Altman Analysis (Fuzzy vs Threshold)"
            chartId="chart-bland-altman"
          >
            {!blandAltmanData ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-900 dark:text-white font-medium">
                No data
              </div>
            ) : (
              <ObsBlandAltman
                data={blandAltmanData.data}
                meanDiff={blandAltmanData.meanDiff}
                upperLoA={blandAltmanData.upperLoA}
                lowerLoA={blandAltmanData.lowerLoA}
              />
            )}
          </ChartCard>
        </section>
      )}
    </div>
  );
}
