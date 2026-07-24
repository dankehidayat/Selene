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
  ReferenceLine,
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
  Leaf,
  Brain,
  CloudSun,
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
  useEnergyHistory,
} from "@/services/api";
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

function hourToISO(hour: number): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    0,
    0,
  ).toISOString();
}

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

function ForecastBanner() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-[11px] text-blue-600 dark:text-blue-300 w-fit">
      <Info size={12} className="shrink-0" />
      <span>Dashed = predicted. Solid = actual readings.</span>
    </div>
  );
}

function PowerTooltip({
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
      {payload.map((e: any) => (
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
            {e.value}{" "}
            {e.name.includes("Power") || e.name === "Reactive"
              ? "W"
              : e.name === "Current"
                ? "A"
                : ""}
          </span>
        </p>
      ))}
    </div>
  );
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
      <p className="text-gray-400 dark:text-gray-400 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        Energy:{" "}
        <span className="text-gray-900 dark:text-white font-semibold">
          {payload[0]?.value} Wh
        </span>
      </p>
    </div>
  );
}
function EnvTooltip({
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
      {payload.map((e: any) => (
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
      {payload.map((e: any) => (
        <p key={e.name} className="text-gray-400 dark:text-gray-400">
          {e.name}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            {typeof e.value === "number" ? e.value.toFixed(3) : e.value}
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
/** Lightweight disclosure — no height animation (avoids Recharts reflow lag). */
function Accordion({
  title,
  defaultOpen,
  children,
  hint,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition"
      >
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {title}
          </p>
          {hint ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
              {hint}
            </p>
          ) : null}
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* Mount charts only when open — no CSS grid-row animation (that lagged hard) */}
      {open ? (
        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-1">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
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
  const [showForecast, setShowForecast] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "energy" | "environment" | "fuzzy" | "climate-fuzzy"
  >("energy");

  const analyticsTabs: {
    key: "energy" | "environment" | "fuzzy" | "climate-fuzzy";
    label: string;
    icon: typeof Zap;
  }[] = [
    { key: "energy", label: "Energy", icon: Zap },
    { key: "environment", label: "Environment", icon: Leaf },
    { key: "fuzzy", label: "Energy Fuzzy", icon: Brain },
    { key: "climate-fuzzy", label: "Climate Fuzzy", icon: CloudSun },
  ];

  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary(
    energyRange as any,
  );
  const { data: history = [], isLoading: historyLoading } = useReadingHistory(
    energyRange as any,
  );
  const { data: energyHistory = [], isLoading: energyLoading } =
    useEnergyHistory(energyRange as any);
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
  const hourlyClimate = (climate?.hourlyData ?? []).map((h: any) => ({
    ...h,
    timestamp: hourToISO(h.hour),
  }));
  const enrichedHistory = history.map((h: any) => ({
    ...h,
    apparentPower: +(h.voltage * h.current).toFixed(1) || 0,
    reactivePower:
      +Math.sqrt(
        Math.max(0, (h.voltage * h.current) ** 2 - h.power ** 2),
      ).toFixed(1) || 0,
  }));

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
          const fs =
            d.category === "ECONOMICAL" ? 1 : d.category === "NORMAL" ? 2 : 3;
          const ts = d.power <= 30 ? 1 : d.power <= 70 ? 2 : 3;
          return { mean: (fs + ts) / 2, difference: fs - ts };
        });
        const diffs = points.map((p) => p.difference);
        const md = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const sd = Math.sqrt(
          diffs.reduce((a, b) => a + (b - md) ** 2, 0) / diffs.length,
        );
        return {
          data: points,
          meanDiff: +md.toFixed(3),
          upperLoA: +(md + 1.96 * sd).toFixed(3),
          lowerLoA: +(md - 1.96 * sd).toFixed(3),
        };
      })()
    : null;

  const pf = showForecast
    ? ensembleForecast(
        enrichedHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.power,
        })),
        energyRange,
      )
    : { forecast: [], confidence: 0 };
  const efc = showForecast
    ? ensembleForecast(
        energyHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.energy_kwh,
        })),
        energyRange,
      )
    : { forecast: [], confidence: 0 };
  const pb = pf.forecast.length
    ? confidenceBands(pf.forecast)
    : { upper: [], lower: [] };
  const efb = efc.forecast.length
    ? confidenceBands(efc.forecast)
    : { upper: [], lower: [] };

  const envHistory = hourlyClimate.map((h: any) => ({
    timestamp: hourToISO(h.hour),
    temperature: h.temperature,
    humidity: h.humidity,
  }));
  const tf = showForecast
    ? ensembleForecast(
        envHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.temperature,
        })),
        climateRange,
      )
    : { forecast: [], confidence: 0 };
  const hf = showForecast
    ? ensembleForecast(
        envHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.humidity,
        })),
        climateRange,
      )
    : { forecast: [], confidence: 0 };
  const tb = tf.forecast.length
    ? confidenceBands(tf.forecast)
    : { upper: [], lower: [] };
  const hb = hf.forecast.length
    ? confidenceBands(hf.forecast)
    : { upper: [], lower: [] };

  const now = new Date().toISOString();

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Analytics
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
            Energy, environment, and fuzzy intelligence across your fleet
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
          {analyticsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.key === "energy"
                    ? "Energy"
                    : tab.key === "environment"
                      ? "Env"
                      : tab.key === "fuzzy"
                        ? "E-Fuzzy"
                        : "C-Fuzzy"}
                </span>
              </button>
            );
          })}
        </div>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForecast(!showForecast)}
                className={`text-xs font-medium px-2 py-1 rounded-lg border transition ${showForecast ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                Forecast
              </button>
              <RangeSelect
                options={RANGE_OPTIONS}
                value={energyRange}
                onChange={setEnergyRange}
                labels={RANGE_LABELS}
              />
            </div>
          </div>
          {showForecast && <ForecastBanner />}
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

          <ChartCard title="Energy Usage" chartId="chart-energy-usage">
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
                    <linearGradient id="ePowerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.15}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
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
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="eApparentGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="eReactiveGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="epfb" x1="0" y1="0" x2="0" y2="1">
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
                  <Tooltip content={<PowerTooltip range={energyRange} />} />
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
                        id: "power",
                      },
                      {
                        value: "Current (A)",
                        type: "line" as const,
                        color: "#F59E0B",
                        id: "current",
                      },
                      {
                        value: "Apparent (VA)",
                        type: "line" as const,
                        color: "#8B5CF6",
                        id: "apparentPower",
                      },
                      {
                        value: "Reactive (VAR)",
                        type: "line" as const,
                        color: "#EF4444",
                        id: "reactivePower",
                      },
                      ...(pf.forecast.length
                        ? [
                            {
                              value: "Power Forecast",
                              type: "line" as const,
                              color: "#3B82F6",
                              id: "pf",
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
                  {pb.upper.length > 0 && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      data={pb.upper}
                      dataKey="value"
                      stroke="none"
                      fill="url(#epfb)"
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
                      name="Power Forecast"
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Usage Pattern" chartId="chart-peak-hours">
              {energyRange === "1h" ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-4 text-center">
                  Hourly breakdown requires at least 24 hours of data
                </div>
              ) : allPeakHours.length === 0 ? (
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

            <ChartCard
              title="Energy Consumption"
              chartId="chart-energy-consumption"
            >
              {energyRange === "1h" ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-4 text-center">
                  Energy data requires at least 24 hours of data
                </div>
              ) : energyLoading ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : energyHistory.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={energyHistory}>
                    <defs>
                      <linearGradient
                        id="energyGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#10B981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="efbGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity={0.06}
                        />
                        <stop
                          offset="100%"
                          stopColor="#10B981"
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
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      label={{
                        value: "Wh",
                        position: "insideTopLeft",
                        offset: -5,
                        style: CHART_FONT,
                      }}
                    />
                    <Tooltip content={<EnergyTooltip range={energyRange} />} />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        fontFamily: "Inter, sans-serif",
                      }}
                      payload={[
                        {
                          value: "Energy (Wh)",
                          type: "rect",
                          color: "#10B981",
                          id: "energy_kwh",
                        },
                        ...(efc.forecast.length
                          ? [
                              {
                                value: "Energy Forecast",
                                type: "line" as const,
                                color: "#10B981",
                                id: "ef",
                              },
                            ]
                          : []),
                      ]}
                    />
                    {efc.forecast.length > 0 && (
                      <ReferenceLine
                        x={now}
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
                      type="monotone"
                      dataKey="energy_kwh"
                      fill="url(#energyGrad)"
                      stroke="none"
                      hide
                    />
                    <Bar
                      dataKey="energy_kwh"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name="Energy (Wh)"
                    />
                    {efb.upper.length > 0 && (
                      <Area
                        type="monotone"
                        data={efb.upper}
                        dataKey="value"
                        stroke="none"
                        fill="url(#efbGrad)"
                        hide
                      />
                    )}
                    {efc.forecast.length > 0 && (
                      <Line
                        type="monotone"
                        data={efc.forecast}
                        dataKey="value"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="6,4"
                        dot={false}
                        name="Energy Forecast"
                        connectNulls
                      />
                    )}
                  </ComposedChart>
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowForecast(!showForecast)}
                className={`text-xs font-medium px-2 py-1 rounded-lg border transition ${showForecast ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                Forecast
              </button>
              <RangeSelect
                options={RANGE_OPTIONS}
                value={climateRange}
                onChange={setClimateRange}
                labels={RANGE_LABELS}
              />
            </div>
          </div>
          {showForecast && <ForecastBanner />}
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
                      <linearGradient id="ctfb" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#EF4444"
                          stopOpacity={0.06}
                        />
                        <stop
                          offset="100%"
                          stopColor="#EF4444"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="chfb" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#3B82F6"
                          stopOpacity={0.06}
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
                      dataKey="timestamp"
                      tick={CHART_FONT}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return d.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      }}
                      interval="preserveStartEnd"
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
                    <Tooltip content={<EnvTooltip range={climateRange} />} />
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
                          id: "temperature",
                        },
                        {
                          value: "Humidity (%)",
                          type: "line" as const,
                          color: "#3B82F6",
                          id: "humidity",
                        },
                        ...(tf.forecast.length
                          ? [
                              {
                                value: "Temp Forecast",
                                type: "line" as const,
                                color: "#EF4444",
                                id: "tfc",
                              },
                            ]
                          : []),
                        ...(hf.forecast.length
                          ? [
                              {
                                value: "Humid Forecast",
                                type: "line" as const,
                                color: "#3B82F6",
                                id: "hfc",
                              },
                            ]
                          : []),
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
                    {tb.upper.length > 0 && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        data={tb.upper}
                        dataKey="value"
                        stroke="none"
                        fill="url(#ctfb)"
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
                        name="Temp Forecast"
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
                        fill="url(#chfb)"
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
                        name="Humid Forecast"
                        connectNulls
                      />
                    )}
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
              labels={RANGE_LABELS}
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
          <Accordion
            title="Membership Functions"
            hint="Static fuzzy sets for voltage & power — expand to inspect shapes"
            defaultOpen={false}
          >
            <div className="grid lg:grid-cols-2 gap-4">
              <ChartCard title="Voltage Membership" chartId="chart-voltage-mf">
                {!membership ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={membership.voltageMembership}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                      <XAxis dataKey="x" tick={CHART_FONT} />
                      <YAxis domain={[0, 1]} tick={CHART_FONT} width={32} />
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
                        isAnimationActive={false}
                        name="Low"
                      />
                      <Line
                        type="monotone"
                        dataKey="normal"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        name="Normal"
                      />
                      <Line
                        type="monotone"
                        dataKey="high"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        name="High"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard title="Power Membership" chartId="chart-power-mf">
                {!membership ? (
                  <div className="flex h-[220px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={membership.powerMembership}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#E5E7EB" strokeOpacity={0.3} />
                      <XAxis dataKey="x" tick={CHART_FONT} />
                      <YAxis domain={[0, 1]} tick={CHART_FONT} width={32} />
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
                        isAnimationActive={false}
                        name="Economical"
                      />
                      <Line
                        type="monotone"
                        dataKey="normal"
                        stroke="#3498db"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        name="Normal"
                      />
                      <Line
                        type="monotone"
                        dataKey="wasteful"
                        stroke="#e74c3c"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
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
              labels={RANGE_LABELS}
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
