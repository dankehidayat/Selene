// apps/frontend/src/pages/Analytics.tsx
import { useState, useRef, useEffect } from "react";
import * as Plot from "@observablehq/plot";
import * as HoverCard from "@radix-ui/react-hover-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  Area,
  ComposedChart,
  Line,
  LineChart,
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
  Info,
  ChevronDown,
  TrendingDown,
  Minus,
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
  useClimateFuzzyDistribution,
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
const CLIMATE_FUZZY_COLORS: Record<string, string> = {
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

function EnergyTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  range: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {payload.map((entry: any) => (
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
            {entry.name.includes("Power") || entry.name === "Reactive"
              ? "W"
              : entry.name === "Current"
                ? "A"
                : ""}
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
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        Hour: {label}:00
      </p>
      {payload.map((entry: any) => (
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

function PeakTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
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

function ComfortTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
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
}: {
  active?: boolean;
  payload?: any[];
  total: number;
}) {
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

function MembershipTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className={TOOLTIP_CLASS}>
      <p className="text-gray-400 dark:text-gray-400 mb-1">
        Value:{" "}
        <span className="text-gray-700 dark:text-gray-200 font-medium">
          {label}
        </span>
      </p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-gray-400 dark:text-gray-400">
          {entry.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {typeof entry.value === "number"
              ? entry.value.toFixed(3)
              : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function InfoPopover({ title, content }: { title: string; content: string }) {
  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <span className="inline-flex cursor-help">
          <Info
            size={13}
            className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          />
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={8}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xl p-4 w-80 z-50"
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {content}
          </p>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function Accordion({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
      >
        <span className="flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-gray-400">
            (static reference data)
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Observable Plot Components ─────────────────────────────
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
function ObsClimateScatter({
  data,
}: {
  data: Array<{ temperature: number; humidity: number; category: string }>;
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
        domain: ["COLD", "COOL", "COMFORTABLE", "WARM", "HOT"],
        range: [
          CLIMATE_FUZZY_COLORS.COLD,
          CLIMATE_FUZZY_COLORS.COOL,
          CLIMATE_FUZZY_COLORS.COMFORTABLE,
          CLIMATE_FUZZY_COLORS.WARM,
          CLIMATE_FUZZY_COLORS.HOT,
        ],
      },
      x: { label: "Temperature (°C)" },
      y: { label: "Humidity (%)" },
      marks: [
        Plot.dot(data, {
          x: "temperature",
          y: "humidity",
          fill: "category",
          r: 5,
          opacity: 0.7,
          stroke: "#1E293B",
          strokeWidth: 0.5,
        }),
        Plot.ruleX([24], {
          stroke: "#3B82F6",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.5,
        }),
        Plot.ruleX([28], {
          stroke: "#F59E0B",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.5,
        }),
        Plot.ruleY([50], {
          stroke: "#3B82F6",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.5,
        }),
        Plot.ruleY([70], {
          stroke: "#EF4444",
          strokeWidth: 1.5,
          strokeDasharray: "4,4",
          opacity: 0.5,
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
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
        <span>
          Mean Diff:{" "}
          <strong className="text-gray-900 dark:text-white">
            {meanDiff.toFixed(3)}
          </strong>
        </span>
        <span>
          Upper LoA:{" "}
          <strong className="text-gray-900 dark:text-white">
            {upperLoA.toFixed(3)}
          </strong>
        </span>
        <span>
          Lower LoA:{" "}
          <strong className="text-gray-900 dark:text-white">
            {lowerLoA.toFixed(3)}
          </strong>
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
      y: { label: "Power Factor", domain: [0.3, 1] },
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

function MetricRow({
  label,
  value,
  unit,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: typeof Zap;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2.5">
        <Icon size={15} className={color} />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
        {value}
        {unit ? (
          <span className="text-gray-400 dark:text-gray-500 ml-0.5 font-medium">
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function Analytics() {
  const [energyRange, setEnergyRange] = useState<string>("7d");
  const [climateRange, setClimateRange] = useState<string>("7d");
  const [climateFuzzyRange, setClimateFuzzyRange] = useState<string>("7d");
  const [activeTab, setActiveTab] = useState<
    "energy" | "environment" | "fuzzy" | "climate-fuzzy"
  >("energy");

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(
    energyRange as any,
  );
  const { data: history = [], isLoading: historyLoading } = useReadingHistory(
    energyRange as any,
  );
  const { data: climate, isLoading: climateLoading } = useClimateSummary(
    climateRange as any,
  );
  const { data: fuzzy, isLoading: fuzzyLoading } =
    useFuzzyDistribution(energyRange);
  const { data: membership } = useMembershipData();
  const { data: decisionSurface } = useDecisionSurface();
  const { data: climateFuzzy, isLoading: climateFuzzyLoading } =
    useClimateFuzzyDistribution(climateFuzzyRange);

  const allPeakHours = Array.from({ length: 24 }, (_, i) => {
    const found = summary?.peakHours?.find((p: any) => p.hour === i);
    return { name: `${i}:00`, power: found?.avgPower ?? 0 };
  });
  const comfortData = climate?.comfortDistribution ?? [];
  const hourlyClimate = climate?.hourlyData ?? [];

  const pieData = fuzzy
    ? [
        { name: "ECONOMICAL", value: fuzzy.distribution?.ECONOMICAL ?? 0 },
        { name: "NORMAL", value: fuzzy.distribution?.NORMAL ?? 0 },
        { name: "WASTEFUL", value: fuzzy.distribution?.WASTEFUL ?? 0 },
      ].filter((d) => d.value > 0)
    : [];

  const climatePieData = climateFuzzy
    ? [
        {
          name: "COLD",
          value: climateFuzzy.distribution?.COLD ?? 0,
          color: CLIMATE_FUZZY_COLORS.COLD,
        },
        {
          name: "COOL",
          value: climateFuzzy.distribution?.COOL ?? 0,
          color: CLIMATE_FUZZY_COLORS.COOL,
        },
        {
          name: "COMFORTABLE",
          value: climateFuzzy.distribution?.COMFORTABLE ?? 0,
          color: CLIMATE_FUZZY_COLORS.COMFORTABLE,
        },
        {
          name: "WARM",
          value: climateFuzzy.distribution?.WARM ?? 0,
          color: CLIMATE_FUZZY_COLORS.WARM,
        },
        {
          name: "HOT",
          value: climateFuzzy.distribution?.HOT ?? 0,
          color: CLIMATE_FUZZY_COLORS.HOT,
        },
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

  const enrichedHistory = history.map((h: any) => ({
    ...h,
    apparentPower: +(h.voltage * h.current).toFixed(1) || 0,
    reactivePower:
      +Math.sqrt(
        Math.max(0, (h.voltage * h.current) ** 2 - h.power ** 2),
      ).toFixed(1) || 0,
  }));

  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
        {(["energy", "environment", "fuzzy", "climate-fuzzy"] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${activeTab === tab ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"}`}
            >
              {tab === "energy"
                ? "Energy"
                : tab === "environment"
                  ? "Environment"
                  : tab === "fuzzy"
                    ? "Energy Fuzzy"
                    : "Climate Fuzzy"}
            </button>
          ),
        )}
      </div>

      {/* ═════ ENERGY ═════ */}
      {activeTab === "energy" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Energy Analysis
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Power consumption patterns and statistical summaries
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
              value={summaryLoading ? "..." : (summary?.power?.average ?? "—")}
              unit="W"
              icon={Zap}
              iconColor="text-amber-500 dark:text-amber-400"
            />
            <StatCard
              label="Total Energy"
              value={
                summaryLoading ? "..." : (summary?.energy?.totalKwh ?? "—")
              }
              unit="kWh"
              icon={Activity}
              iconColor="text-cyan-500 dark:text-cyan-400"
            />
            <StatCard
              label="Est. Cost"
              value={
                summaryLoading ? "..." : (summary?.energy?.estimatedCost ?? "—")
              }
              icon={DollarSign}
              iconColor="text-emerald-500 dark:text-emerald-400"
            />
            <StatCard
              label="Data Points"
              value={summaryLoading ? "..." : (summary?.dataPoints ?? "—")}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Energy Usage" chartId="chart-energy-history">
              {historyLoading ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : enrichedHistory.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={enrichedHistory}>
                    <defs>
                      <linearGradient
                        id="ePowerGrad"
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
                        <stop
                          offset="100%"
                          stopColor="#3B82F6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="eCurrentGrad"
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
                        <stop
                          offset="100%"
                          stopColor="#F59E0B"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="eApparentGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#8B5CF6"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="100%"
                          stopColor="#8B5CF6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="eReactiveGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#EF4444"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="100%"
                          stopColor="#EF4444"
                          stopOpacity={0}
                        />
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
                      tickFormatter={(v: string) => formatTick(v, energyRange)}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip content={<EnergyTooltip range={energyRange} />} />
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
                        {
                          value: "Apparent (VA)",
                          type: "line",
                          color: "#8B5CF6",
                          id: "apparentPower",
                        },
                        {
                          value: "Reactive (VAR)",
                          type: "line",
                          color: "#EF4444",
                          id: "reactivePower",
                        },
                      ]}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="power"
                      fill="url(#ePowerGrad)"
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
                      fill="url(#eCurrentGrad)"
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
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="apparentPower"
                      fill="url(#eApparentGrad)"
                      stroke="none"
                      hide
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="apparentPower"
                      stroke="#8B5CF6"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4,3"
                      name="Apparent (VA)"
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="reactivePower"
                      fill="url(#eReactiveGrad)"
                      stroke="none"
                      hide
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="reactivePower"
                      stroke="#EF4444"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4,3"
                      name="Reactive (VAR)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Usage Pattern" chartId="chart-peak-hours">
              {allPeakHours.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={allPeakHours}
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
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
                      width={45}
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
                      name="Avg Power (W)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <ChartCard title="Key Metrics">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <MetricRow
                  label="Mean (μ)"
                  value={summary?.power?.average ?? "..."}
                  unit="W"
                  icon={Activity}
                  color="text-blue-500"
                />
                <MetricRow
                  label="Median"
                  value={summary?.power?.median ?? "..."}
                  unit="W"
                  icon={Minus}
                  color="text-gray-400"
                />
                <MetricRow
                  label="Std Deviation (σ)"
                  value={summary ? `±${summary.power?.stdDeviation}` : "..."}
                  unit="W"
                  icon={TrendingUp}
                  color="text-violet-500"
                />
                <MetricRow
                  label="Min"
                  value={summary?.power?.min ?? "..."}
                  unit="W"
                  icon={TrendingDown}
                  color="text-emerald-500"
                />
                <MetricRow
                  label="Max"
                  value={summary?.power?.max ?? "..."}
                  unit="W"
                  icon={TrendingUp}
                  color="text-red-500"
                />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <MetricRow
                  label="Avg Voltage"
                  value={summary?.voltage?.average ?? "..."}
                  unit="V"
                  icon={Zap}
                  color="text-amber-500"
                />
                <MetricRow
                  label="Avg cos φ"
                  value={summary?.powerFactor?.average ?? "..."}
                  icon={Gauge}
                  color="text-cyan-500"
                />
                <MetricRow
                  label="Avg Reactive"
                  value={summary?.reactivePower?.average ?? "..."}
                  unit="VAR"
                  icon={Activity}
                  color="text-orange-500"
                />
                <MetricRow
                  label="Reactive/Active"
                  value={summary?.reactivePower?.ratio ?? "..."}
                  icon={BarChart3}
                  color="text-gray-400"
                />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <MetricRow
                  label="Total Consumption"
                  value={summary?.energy?.totalKwh ?? "..."}
                  unit="kWh"
                  icon={DollarSign}
                  color="text-emerald-500"
                />
                <MetricRow
                  label="Estimated Cost"
                  value={summary?.energy?.estimatedCost ?? "..."}
                  icon={DollarSign}
                  color="text-emerald-600"
                />
                <MetricRow
                  label="Sample Size"
                  value={summary?.dataPoints ?? "..."}
                  unit="readings"
                  icon={BarChart3}
                  color="text-violet-500"
                />
                <MetricRow
                  label="Period"
                  value={
                    summary
                      ? `${new Date(summary.timeSpan.from).toLocaleDateString()} – ${new Date(summary.timeSpan.to).toLocaleDateString()}`
                      : "..."
                  }
                  icon={Minus}
                  color="text-gray-400"
                />
              </div>
            </div>
          </ChartCard>
        </section>
      )}

      {/* ═════ ENVIRONMENT ═════ */}
      {activeTab === "environment" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Environment Analysis
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                Temperature, humidity, and climate comfort analytics
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
              value={
                climateLoading ? "..." : (climate?.temperature?.average ?? "—")
              }
              unit="°C"
              icon={Thermometer}
              iconColor="text-rose-500 dark:text-rose-400"
            />
            <StatCard
              label="Avg Humidity"
              value={
                climateLoading ? "..." : (climate?.humidity?.average ?? "—")
              }
              unit="%"
              icon={Droplets}
              iconColor="text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Dew Point"
              value={
                climateLoading ? "..." : (climate?.dewPoint?.average ?? "—")
              }
              unit="°C"
              icon={Gauge}
              iconColor="text-cyan-500 dark:text-cyan-400"
            />
            <StatCard
              label="Correlation"
              value={
                climateLoading
                  ? "..."
                  : (climate?.correlation?.tempHumidity ?? "—")
              }
              icon={TrendingUp}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Climate History" chartId="chart-climate-history">
              {climateLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : hourlyClimate.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={hourlyClimate}>
                    <defs>
                      <linearGradient
                        id="climTempGrad"
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
                        <stop
                          offset="100%"
                          stopColor="#EF4444"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="climHumGrad"
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
                        <stop
                          offset="100%"
                          stopColor="#3B82F6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
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
                    <Tooltip content={<ClimateTooltip />} />
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
                      fill="url(#climTempGrad)"
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
                      name="Temperature (°C)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="humidity"
                      fill="url(#climHumGrad)"
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
                      name="Humidity (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title="Comfort Distribution"
              chartId="chart-comfort-dist"
            >
              {climateLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : comfortData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
          <ChartCard title="Climate Metrics">
            <div className="grid sm:grid-cols-2 gap-x-8">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <MetricRow
                  label="Mean Temp (μ)"
                  value={climate?.temperature?.average ?? "..."}
                  unit="°C"
                  icon={Thermometer}
                  color="text-rose-500"
                />
                <MetricRow
                  label="Median Temp"
                  value={climate?.temperature?.median ?? "..."}
                  unit="°C"
                  icon={Minus}
                  color="text-gray-400"
                />
                <MetricRow
                  label="Std Deviation (σ)"
                  value={
                    climate ? `±${climate.temperature?.stdDeviation}` : "..."
                  }
                  unit="°C"
                  icon={TrendingUp}
                  color="text-violet-500"
                />
                <MetricRow
                  label="Min Temp"
                  value={climate?.temperature?.min ?? "..."}
                  unit="°C"
                  icon={TrendingDown}
                  color="text-emerald-500"
                />
                <MetricRow
                  label="Max Temp"
                  value={climate?.temperature?.max ?? "..."}
                  unit="°C"
                  icon={TrendingUp}
                  color="text-red-500"
                />
                <MetricRow
                  label="Degree-Hours (>18°C)"
                  value={climate?.temperature?.degreeHours ?? "..."}
                  icon={Gauge}
                  color="text-cyan-500"
                />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <MetricRow
                  label="Mean Humidity (μ)"
                  value={climate?.humidity?.average ?? "..."}
                  unit="%"
                  icon={Droplets}
                  color="text-blue-500"
                />
                <MetricRow
                  label="Median Humidity"
                  value={climate?.humidity?.median ?? "..."}
                  unit="%"
                  icon={Minus}
                  color="text-gray-400"
                />
                <MetricRow
                  label="Std Deviation (σ)"
                  value={climate ? `±${climate.humidity?.stdDeviation}` : "..."}
                  unit="%"
                  icon={TrendingUp}
                  color="text-violet-500"
                />
                <MetricRow
                  label="Min Humidity"
                  value={climate?.humidity?.min ?? "..."}
                  unit="%"
                  icon={TrendingDown}
                  color="text-emerald-500"
                />
                <MetricRow
                  label="Max Humidity"
                  value={climate?.humidity?.max ?? "..."}
                  unit="%"
                  icon={TrendingUp}
                  color="text-red-500"
                />
                <MetricRow
                  label="Correlation"
                  value={climate?.correlation?.tempHumidity ?? "..."}
                  icon={TrendingUp}
                  color="text-violet-500"
                />
              </div>
            </div>
          </ChartCard>
        </section>
      )}

      {/* ═════ ENERGY FUZZY ═════ */}
      {activeTab === "fuzzy" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Energy Fuzzy Analysis
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Multi-variable fuzzy inference for energy classification
                </p>
                <InfoPopover
                  title="IEEE 1159 & PLN Standards"
                  content="Based on IEEE 1159-2019 and PLN standards requiring power factor ≥ 0.85. Uses Mamdani fuzzy inference with 15 rules across 4 input variables."
                />
              </div>
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
              value={
                fuzzyLoading ? "..." : (fuzzy?.distribution?.ECONOMICAL ?? "—")
              }
              icon={PieChartIcon}
              iconColor="text-emerald-500 dark:text-emerald-400"
            />
            <StatCard
              label="Normal"
              value={
                fuzzyLoading ? "..." : (fuzzy?.distribution?.NORMAL ?? "—")
              }
              icon={PieChartIcon}
              iconColor="text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Wasteful"
              value={
                fuzzyLoading ? "..." : (fuzzy?.distribution?.WASTEFUL ?? "—")
              }
              icon={PieChartIcon}
              iconColor="text-red-500 dark:text-red-400"
            />
            <StatCard
              label="Total"
              value={fuzzyLoading ? "..." : (fuzzy?.total ?? "—")}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Energy Category Distribution"
              chartId="chart-fuzzy-pie"
            >
              {fuzzyLoading ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : pieData.length === 0 ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
              title="Power vs Power Factor"
              chartId="chart-fuzzy-scatter"
            >
              {fuzzyLoading ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : !fuzzy?.scatterData?.length ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ObsScatter data={fuzzy.scatterData} />
              )}
            </ChartCard>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Decision Surface"
              chartId="chart-decision-surface"
            >
              {!decisionSurface || !fuzzy?.scatterData ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
              title="Power Distribution by Category"
              chartId="chart-box-plot"
            >
              {fuzzyLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : !fuzzy?.results?.length ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
          </div>
          <ChartCard title="Bland-Altman Analysis" chartId="chart-bland-altman">
            {!blandAltmanData ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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
          <Accordion title="Membership Functions">
            <div className="grid lg:grid-cols-2 gap-4 pt-2">
              <ChartCard title="Voltage Membership" chartId="chart-voltage-mf">
                {!membership ? (
                  <div className="flex h-[250px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={membership.voltageMembership}>
                      <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                      <XAxis dataKey="x" tick={CHART_FONT} />
                      <YAxis domain={[0, 1]} tick={CHART_FONT} />
                      <Tooltip content={<MembershipTooltip />} />
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
              <ChartCard title="Power Membership" chartId="chart-power-mf">
                {!membership ? (
                  <div className="flex h-[250px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={membership.powerMembership}>
                      <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                      <XAxis dataKey="x" tick={CHART_FONT} />
                      <YAxis domain={[0, 1]} tick={CHART_FONT} />
                      <Tooltip content={<MembershipTooltip />} />
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
          </Accordion>
        </section>
      )}

      {/* ═════ CLIMATE FUZZY ═════ */}
      {activeTab === "climate-fuzzy" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Climate Fuzzy Analysis
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Fuzzy inference for thermal comfort classification
                </p>
                <InfoPopover
                  title="ASHRAE 55 & SNI 03-6572"
                  content="Based on ASHRAE 55-2020 and SNI 03-6572-2001. Adapted for naturally ventilated buildings in tropical climates. 14 rules across 2 input variables."
                />
              </div>
            </div>
            <RangeSelect
              options={RANGE_OPTIONS}
              value={climateFuzzyRange}
              onChange={setClimateFuzzyRange}
            />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
            <StatCard
              label="Cold"
              value={
                climateFuzzyLoading
                  ? "..."
                  : (climateFuzzy?.distribution?.COLD ?? "—")
              }
              icon={Thermometer}
              iconColor="text-blue-500 dark:text-blue-400"
            />
            <StatCard
              label="Cool"
              value={
                climateFuzzyLoading
                  ? "..."
                  : (climateFuzzy?.distribution?.COOL ?? "—")
              }
              icon={Thermometer}
              iconColor="text-cyan-500 dark:text-cyan-400"
            />
            <StatCard
              label="Comfortable"
              value={
                climateFuzzyLoading
                  ? "..."
                  : (climateFuzzy?.distribution?.COMFORTABLE ?? "—")
              }
              icon={Thermometer}
              iconColor="text-emerald-500 dark:text-emerald-400"
            />
            <StatCard
              label="Warm"
              value={
                climateFuzzyLoading
                  ? "..."
                  : (climateFuzzy?.distribution?.WARM ?? "—")
              }
              icon={Thermometer}
              iconColor="text-amber-500 dark:text-amber-400"
            />
            <StatCard
              label="Hot"
              value={
                climateFuzzyLoading
                  ? "..."
                  : (climateFuzzy?.distribution?.HOT ?? "—")
              }
              icon={Thermometer}
              iconColor="text-red-500 dark:text-red-400"
            />
            <StatCard
              label="Total"
              value={climateFuzzyLoading ? "..." : (climateFuzzy?.total ?? "—")}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Climate Category Distribution"
              chartId="chart-climate-fuzzy-pie"
            >
              {climateFuzzyLoading ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : climatePieData.length === 0 ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <Pie
                      data={climatePieData}
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
                      {climatePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<PieTooltip total={climateFuzzy?.total || 0} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard
              title="Temperature vs Humidity"
              chartId="chart-climate-fuzzy-scatter"
            >
              {climateFuzzyLoading ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : !climateFuzzy?.scatterData?.length ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ObsClimateScatter data={climateFuzzy.scatterData} />
              )}
            </ChartCard>
          </div>
        </section>
      )}
    </div>
  );
}
