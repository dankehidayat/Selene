// apps/frontend/src/pages/Analytics.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import * as Plot from "@observablehq/plot";

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
  TrendingDown,
  Minus,
  Leaf,
  Brain,
  CloudSun,
} from "lucide-react";
import {
  ChartCard,
  ToggleControl,
  ConfidencePill,
  ForecastLegendHint,
} from "@/components/ChartCard";
import { RangeFilter } from "@/components/RangeFilter";
import { StatCard, EST_COST_INFO, TOTAL_ENERGY_INFO } from "@/components/StatCard";
import { InfoTip } from "@/components/InfoTip";
import { useTabFromSearch } from "@/hooks/useTabFromSearch";
import { useChartMaxPoints } from "@/hooks/useChartMaxPoints";
import { computeDomain } from "@/lib/chartDomain";
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
import { cn } from "@/lib/utils";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { NivoBarChart } from "@/components/charts/NivoBarChart";
import { NivoPieChart } from "@/components/charts/NivoPieChart";

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

function formatDateForTooltip(iso: string, spanHours: number): string {
  const d = new Date(iso);
  const now = new Date();
  const isFuture = d > now;
  const prefix = isFuture ? "Predicted · " : "";
  if (spanHours <= 2) {
    return (
      prefix +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  if (spanHours <= 48) {
    return (
      prefix +
      d.toLocaleDateString([], { weekday: "short" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  if (spanHours <= 168) {
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
  }
  if (spanHours <= 720) {
    return (
      prefix + d.toLocaleDateString([], { month: "short", day: "numeric" })
    );
  }
  return (
    prefix + d.toLocaleDateString([], { month: "short", year: "numeric" })
  );
}
function formatTick(v: string, spanHours: number): string {
  const d = new Date(v);
  if (spanHours <= 48) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (spanHours <= 168) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  if (spanHours <= 720) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short" });
}

/** Hours between from/to (default 24 when unset). */
function getSpanHours(from: string | null, to: string | null): number {
  if (from && to) {
    return (new Date(to).getTime() - new Date(from).getTime()) / 3600000;
  }
  return 24;
}

/** Soft overlapping membership curves — always visible, no accordion bury. */
function MembershipPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 px-0.5">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium max-w-xl">
            {description}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
          μ ∈ [0, 1]
        </p>
      </div>
      {children}
    </section>
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
  infoTitle,
  infoContent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: typeof Zap;
  color: string;
  infoTitle?: string;
  infoContent?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={15} className={cn(color, "shrink-0")} />
        <span className="text-sm text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
          {label}
          {infoTitle && infoContent ? (
            <InfoTip title={infoTitle} content={infoContent} iconSize={12} />
          ) : null}
        </span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">
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

const ANALYTICS_TAB_KEYS = [
  "energy",
  "environment",
  "fuzzy",
  "climate-fuzzy",
] as const;

export function Analytics() {
  const [energyRange, setEnergyRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [climateRange, setClimateRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [climateFuzzyRange, setClimateFuzzyRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [showForecast, setShowForecast] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "energy" | "environment" | "fuzzy" | "climate-fuzzy"
  >("energy");

  useTabFromSearch(ANALYTICS_TAB_KEYS, setActiveTab);

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

  const isEnergyTab = activeTab === "energy";
  const isEnvTab = activeTab === "environment";
  const isFuzzyTab = activeTab === "fuzzy";
  const isClimateFuzzyTab = activeTab === "climate-fuzzy";
  const chartMaxPoints = useChartMaxPoints();
  const energySpanHours = getSpanHours(energyRange.from, energyRange.to);
  const climateSpanHours = getSpanHours(climateRange.from, climateRange.to);
  const climateFuzzySpanHours = getSpanHours(climateFuzzyRange.from, climateFuzzyRange.to);

  const energyQuery = energyRange.from
    ? { from: energyRange.from, to: energyRange.to! }
    : { range: "24h" };
  const climateQuery = climateRange.from
    ? { from: climateRange.from, to: climateRange.to! }
    : { range: "24h" };
  const climateFuzzyQuery = climateFuzzyRange.from
    ? { from: climateFuzzyRange.from, to: climateFuzzyRange.to! }
    : { range: "24h" };

  // Stage 1: lightweight summary/stats first
  const {
    data: summary,
    isLoading: summaryLoading,
    isSuccess: summaryReady,
    isError: summaryFailed,
  } = useAnalyticsSummary(energyQuery, isEnergyTab);

  const {
    data: climate,
    isLoading: climateLoading,
    isSuccess: climateReady,
    isError: climateFailed,
  } = useClimateSummary(climateQuery, isEnvTab);

  // Stage 2: charts only after summary settles (progressive loading)
  const energyChartsReady =
    isEnergyTab && (summaryReady || summaryFailed || !summaryLoading);
  const envChartsReady =
    isEnvTab && (climateReady || climateFailed || !climateLoading);

  const { data: history = [], isLoading: historyLoading } = useReadingHistory(
    energyQuery,
    energyChartsReady,
    chartMaxPoints,
  );
  const { data: energyHistory = [], isLoading: energyLoading } =
    useEnergyHistory(energyQuery, energyChartsReady, chartMaxPoints);

  // Fuzzy: distribution first wave; heavy static bits after distribution lands
  const { data: fuzzy, isLoading: fuzzyLoading, isSuccess: fuzzyReady } =
    useFuzzyDistribution(energyQuery, isFuzzyTab);
  const { data: membership } = useMembershipData(isFuzzyTab && fuzzyReady);
  const { data: decisionSurface } = useDecisionSurface(
    isFuzzyTab && fuzzyReady,
  );
  const { data: climateFuzzy, isLoading: climateFuzzyLoading } =
    useClimateFuzzyDistribution(climateFuzzyQuery, isClimateFuzzyTab);

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
  const blandAltmanData =
    fuzzy?.blandAltman ??
    (fuzzy?.boxSamples
      ? null
      : fuzzy?.results
        ? (() => {
            // Legacy fallback if API still returns results
            const points = fuzzy.results.map((d: any) => {
              const fs =
                d.category === "ECONOMICAL"
                  ? 1
                  : d.category === "NORMAL"
                    ? 2
                    : 3;
              const ts = d.power <= 30 ? 1 : d.power <= 70 ? 2 : 3;
              return { mean: (fs + ts) / 2, difference: fs - ts };
            });
            const diffs = points.map((p) => p.difference);
            const md = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1);
            const sd = Math.sqrt(
              diffs.reduce((a, b) => a + (b - md) ** 2, 0) /
                (diffs.length || 1),
            );
            return {
              data: points,
              meanDiff: +md.toFixed(3),
              upperLoA: +(md + 1.96 * sd).toFixed(3),
              lowerLoA: +(md - 1.96 * sd).toFixed(3),
            };
          })()
        : null);

  const pf = showForecast
    ? ensembleForecast(
        enrichedHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.power,
        })),
        energyRange.from ? { from: energyRange.from, to: energyRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const efc = showForecast
    ? ensembleForecast(
        energyHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.energy_kwh,
        })),
        energyRange.from ? { from: energyRange.from, to: energyRange.to! } : "24h",
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
        climateRange.from ? { from: climateRange.from, to: climateRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const hf = showForecast
    ? ensembleForecast(
        envHistory.map((h: any) => ({
          timestamp: h.timestamp,
          value: h.humidity,
        })),
        climateRange.from ? { from: climateRange.from, to: climateRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const tb = tf.forecast.length
    ? confidenceBands(tf.forecast)
    : { upper: [], lower: [] };
  const hb = hf.forecast.length
    ? confidenceBands(hf.forecast)
    : { upper: [], lower: [] };

  const now = new Date().toISOString();

  const energyPowerDomain = useMemo(
    () =>
      computeDomain(
        [
          ...enrichedHistory.map((h: any) => h.power),
          ...pf.forecast.map((f) => f.value),
          ...pb.upper.map((f) => f.value),
          ...pb.lower.map((f) => f.value),
        ],
        { floor: 0, pad: 0.1, minPad: 1 },
      ),
    [enrichedHistory, pf.forecast, pb.upper, pb.lower],
  );
  const energyCurrentDomain = useMemo(
    () =>
      computeDomain(
        enrichedHistory.map((h: any) => h.current),
        { floor: 0, pad: 0.1, minPad: 0.05 },
      ),
    [enrichedHistory],
  );
  const energyKwhDomain = useMemo(
    () =>
      computeDomain(
        [
          ...energyHistory.map((h: any) => h.energy_kwh),
          ...efc.forecast.map((f) => f.value),
          ...efb.upper.map((f) => f.value),
          ...efb.lower.map((f) => f.value),
        ],
        { floor: 0, pad: 0.1, minPad: 0.01 },
      ),
    [energyHistory, efc.forecast, efb.upper, efb.lower],
  );
  const envTempDomain = useMemo(
    () =>
      computeDomain(
        [
          ...envHistory.map((h: any) => h.temperature),
          ...tf.forecast.map((f) => f.value),
          ...tb.upper.map((f) => f.value),
          ...tb.lower.map((f) => f.value),
        ],
        { pad: 0.12, minPad: 0.5 },
      ),
    [envHistory, tf.forecast, tb.upper, tb.lower],
  );
  const envHumidityDomain = useMemo(
    () =>
      computeDomain(
        [
          ...envHistory.map((h: any) => h.humidity),
          ...hf.forecast.map((f) => f.value),
          ...hb.upper.map((f) => f.value),
          ...hb.lower.map((f) => f.value),
        ],
        { floor: 0, ceil: 100, pad: 0.08, minPad: 1 },
      ),
    [envHistory, hf.forecast, hb.upper, hb.lower],
  );

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
        {/* Full labels — 2×2 on narrow screens, row on sm+ */}
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {analyticsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-row items-center justify-center gap-1.5 sm:gap-2 min-w-0 px-2 sm:px-3.5 py-2 text-[11px] sm:text-sm font-semibold rounded-lg transition-all duration-200 active:scale-[0.97] ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="text-center sm:text-left leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div key={activeTab} className="animate-tabIn">

      {/* ═════ ENERGY ═════ */}
      {activeTab === "energy" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Energy Analysis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Power consumption patterns and statistical summaries
            </p>
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
              infoTitle={TOTAL_ENERGY_INFO.title}
              infoContent={TOTAL_ENERGY_INFO.content}
            />
            <StatCard
              label="Est. Cost"
              value={
                summaryLoading ? "..." : (summary?.energy?.estimatedCost ?? "—")
              }
              icon={DollarSign}
              iconColor="text-emerald-500 dark:text-emerald-400"
              infoTitle={EST_COST_INFO.title}
              infoContent={EST_COST_INFO.content}
            />
            <StatCard
              label="Data Points"
              value={summaryLoading ? "..." : (summary?.dataPoints ?? "—")}
              icon={BarChart3}
              iconColor="text-violet-500 dark:text-violet-400"
            />
          </div>

          <ChartCard
            title="Energy Usage"
            chartId="chart-energy-usage"
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showForecast && <ForecastLegendHint />}
                {showForecast &&
                  (pf.confidence > 0 || efc.confidence > 0) && (
                    <ConfidencePill
                      percent={Math.round(
                        ((pf.confidence + efc.confidence) / 2) * 100,
                      )}
                    />
                  )}
                <ToggleControl
                  pressed={showForecast}
                  onPressedChange={setShowForecast}
                >
                  Forecast
                </ToggleControl>
                <RangeFilter
                  from={energyRange.from}
                  to={energyRange.to}
                  onChange={(from, to) => setEnergyRange({ from, to })}
                />
              </div>
            }
          >
            {!energyChartsReady || historyLoading ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                Loading chart…
              </div>
            ) : enrichedHistory.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data
              </div>
            ) : (
              <TimeSeriesChart
                height={300}
                spanHours={energySpanHours}
                xTickFormat={(d: Date) => formatTick(d.toISOString(), energySpanHours)}
                tooltipDateFormat={(d: Date) => formatDateForTooltip(d.toISOString(), energySpanHours)}
                leftTickFormat={(v: number) => String(v)}
                rightTickFormat={(v: number) => String(v)}
                leftDomain={energyPowerDomain}
                rightDomain="auto"
                nowMarker={pf.forecast.length ? now : null}
                series={[
                  {
                    id: "power",
                    label: "Power (W)",
                    color: "#3B82F6",
                    axis: "left",
                    data: enrichedHistory.map((h: any) => ({ x: h.timestamp, y: h.power })),
                    area: true,
                    unit: "W",
                  },
                  {
                    id: "current",
                    label: "Current (A)",
                    color: "#F59E0B",
                    axis: "right",
                    data: enrichedHistory.map((h: any) => ({ x: h.timestamp, y: h.current })),
                    area: true,
                    unit: "A",
                  },
                  {
                    id: "apparent",
                    label: "Apparent (VA)",
                    color: "#8B5CF6",
                    axis: "right",
                    data: enrichedHistory.map((h: any) => ({ x: h.timestamp, y: h.apparentPower })),
                    unit: "VA",
                  },
                  {
                    id: "reactive",
                    label: "Reactive (VAR)",
                    color: "#EF4444",
                    axis: "right",
                    data: enrichedHistory.map((h: any) => ({ x: h.timestamp, y: h.reactivePower })),
                    unit: "VAR",
                  },
                  ...(pf.forecast.length
                    ? [
                        {
                          id: "pf",
                          label: "Power Forecast",
                          color: "#3B82F6",
                          axis: "left" as const,
                          data: pf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })),
                          dashed: true,
                          unit: "W" as const,
                        },
                      ]
                    : []),
                ]}
                bands={
                  pb.upper.length
                    ? [
                        {
                          axis: "left" as const,
                          upper: pb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })),
                          lower: pb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })),
                          color: "#3B82F6",
                        },
                      ]
                    : []
                }
                legend={[
                  { label: "Power (W)", color: "#3B82F6" },
                  { label: "Current (A)", color: "#F59E0B" },
                  { label: "Apparent (VA)", color: "#8B5CF6" },
                  { label: "Reactive (VAR)", color: "#EF4444" },
                  ...(pf.forecast.length
                    ? [{ label: "Power Forecast", color: "#3B82F6", dashed: true }]
                    : []),
                ]}
              />
            )}
          </ChartCard>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Usage Pattern" chartId="chart-peak-hours">
              {allPeakHours.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <NivoBarChart
                  data={allPeakHours}
                  indexBy="name"
                  keys={["power"]}
                  colors={["#3B82F6"]}
                  height={260}
                  axisBottomFormat={(v: string) => v}
                  axisLeftFormat={(v: number) => String(v)}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Energy Consumption"
              chartId="chart-energy-consumption"
            >
              {energyLoading ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : energyHistory.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <TimeSeriesChart
                  height={260}
                  spanHours={energySpanHours}
                  xTickFormat={(d: Date) => formatTick(d.toISOString(), energySpanHours)}
                  tooltipDateFormat={(d: Date) => formatDateForTooltip(d.toISOString(), energySpanHours)}
                  leftTickFormat={(v: number) => String(v)}
                  leftDomain={energyKwhDomain}
                  nowMarker={efc.forecast.length ? now : null}
                  series={[
                    {
                      id: "energy_kwh",
                      label: "Energy (kWh)",
                      color: "#10B981",
                      axis: "left",
                      data: energyHistory.map((h: any) => ({ x: h.timestamp, y: h.energy_kwh })),
                      area: true,
                      unit: "kWh",
                    },
                    ...(efc.forecast.length
                      ? [
                          {
                            id: "efc",
                            label: "Energy Forecast",
                            color: "#10B981",
                            axis: "left" as const,
                            data: efc.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            dashed: true,
                            unit: "kWh" as const,
                          },
                        ]
                      : []),
                  ]}
                  bands={
                    efb.upper.length
                      ? [
                          {
                            axis: "left" as const,
                            upper: efb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            lower: efb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            color: "#10B981",
                          },
                        ]
                      : []
                  }
                  legend={[
                    { label: "Energy (kWh)", color: "#10B981" },
                    ...(efc.forecast.length
                      ? [{ label: "Energy Forecast", color: "#10B981", dashed: true }]
                      : []),
                  ]}
                />
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
                  infoTitle={EST_COST_INFO.title}
                  infoContent={EST_COST_INFO.content}
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
                    summary?.timeSpan
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
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Environment Analysis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Temperature, humidity, and climate comfort analytics
            </p>
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
            <ChartCard
              title="Climate History"
              chartId="chart-climate-history"
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {showForecast && <ForecastLegendHint />}
                  {showForecast &&
                    (tf.confidence > 0 || hf.confidence > 0) && (
                      <ConfidencePill
                        percent={Math.round(
                          ((tf.confidence + hf.confidence) / 2) * 100,
                        )}
                      />
                    )}
                  <ToggleControl
                    pressed={showForecast}
                    onPressedChange={setShowForecast}
                  >
                    Forecast
                  </ToggleControl>
                  <RangeFilter
                    from={climateRange.from}
                    to={climateRange.to}
                    onChange={(from, to) => setClimateRange({ from, to })}
                  />
                </div>
              }
            >
              {climateLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : hourlyClimate.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <TimeSeriesChart
                  height={280}
                  spanHours={climateSpanHours}
                  xTickFormat={(d: Date) => formatTick(d.toISOString(), climateSpanHours)}
                  tooltipDateFormat={(d: Date) => formatDateForTooltip(d.toISOString(), climateSpanHours)}
                  leftTickFormat={(v: number) => String(v)}
                  rightTickFormat={(v: number) => String(v)}
                  leftDomain={envTempDomain}
                  rightDomain={envHumidityDomain}
                  nowMarker={tf.forecast.length || hf.forecast.length ? now : null}
                  series={[
                    {
                      id: "temperature",
                      label: "Temperature (°C)",
                      color: "#EF4444",
                      axis: "left",
                      data: hourlyClimate.map((h: any) => ({ x: h.timestamp, y: h.temperature })),
                      area: true,
                      unit: "°C",
                    },
                    {
                      id: "humidity",
                      label: "Humidity (%)",
                      color: "#3B82F6",
                      axis: "right",
                      data: hourlyClimate.map((h: any) => ({ x: h.timestamp, y: h.humidity })),
                      area: true,
                      unit: "%",
                    },
                    ...(tf.forecast.length
                      ? [
                          {
                            id: "tf",
                            label: "Temp Forecast",
                            color: "#EF4444",
                            axis: "left" as const,
                            data: tf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            dashed: true,
                            unit: "°C" as const,
                          },
                        ]
                      : []),
                    ...(hf.forecast.length
                      ? [
                          {
                            id: "hf",
                            label: "Humid Forecast",
                            color: "#3B82F6",
                            axis: "right" as const,
                            data: hf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            dashed: true,
                            unit: "%" as const,
                          },
                        ]
                      : []),
                  ]}
                  bands={[
                    ...(tb.upper.length
                      ? [
                          {
                            axis: "left" as const,
                            upper: tb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            lower: tb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            color: "#EF4444",
                          },
                        ]
                      : []),
                    ...(hb.upper.length
                      ? [
                          {
                            axis: "right" as const,
                            upper: hb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            lower: hb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })),
                            color: "#3B82F6",
                          },
                        ]
                      : []),
                  ]}
                  legend={[
                    { label: "Temperature (°C)", color: "#EF4444" },
                    { label: "Humidity (%)", color: "#3B82F6" },
                    ...(tf.forecast.length
                      ? [{ label: "Temp Forecast", color: "#EF4444", dashed: true }]
                      : []),
                    ...(hf.forecast.length
                      ? [{ label: "Humid Forecast", color: "#3B82F6", dashed: true }]
                      : []),
                  ]}
                />
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
                <NivoBarChart
                  data={comfortData}
                  indexBy="status"
                  keys={["percentage"]}
                  colors={comfortData.map((d: any) => COMFORT_COLORS[d.status] || "#6B7280")}
                  height={280}
                />
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
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Energy Fuzzy Analysis
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Multi-variable fuzzy inference for energy classification
              </p>
              <InfoTip
                title="IEEE 1159 & PLN Standards"
                content="Based on IEEE 1159-2019 and PLN standards requiring power factor ≥ 0.85. Uses Mamdani fuzzy inference with 15 rules across 4 input variables."
              />
            </div>
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
              action={
                <RangeFilter
                  from={energyRange.from}
                  to={energyRange.to}
                  onChange={(from, to) => setEnergyRange({ from, to })}
                />
              }
            >
              {fuzzyLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : pieData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <NivoPieChart
                  data={pieData.map((d) => ({
                    id: d.name,
                    value: d.value,
                    color: FUZZY_COLORS[d.name] || "#6366F1",
                  }))}
                  height={280}
                />
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
              ) : !(
                  fuzzy?.boxSamples?.length || fuzzy?.results?.length
                ) ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <ObsBoxPlot
                  data={
                    fuzzy.boxSamples ??
                    fuzzy.results!.map((d: any) => ({
                      power: d.power,
                      category: d.category,
                    }))
                  }
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
          <MembershipPanel
            title="Membership Functions"
            description="How voltage and power map to fuzzy sets (μ). Overlaps are intentional — they define soft boundaries between categories."
          >
            <div className="grid lg:grid-cols-2 gap-4">
              <ChartCard title="Voltage" chartId="chart-voltage-mf">
                {!membership ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <TimeSeriesChart
                    height={260}
                    spanHours={24}
                    xTickFormat={(d: Date) => String(d.getTime())}
                    tooltipDateFormat={(d: Date) => `Value: ${d.getTime()}`}
                    leftTickFormat={(v: number) => v.toFixed(1)}
                    leftDomain={[0, 1]}
                    series={[
                      {
                        id: "low",
                        label: "Low",
                        color: "#EF4444",
                        axis: "left",
                        data: membership.voltageMembership.map((d: any) => ({ x: d.x, y: d.low })),
                      },
                      {
                        id: "normal",
                        label: "Normal",
                        color: "#10B981",
                        axis: "left",
                        data: membership.voltageMembership.map((d: any) => ({ x: d.x, y: d.normal })),
                      },
                      {
                        id: "high",
                        label: "High",
                        color: "#3B82F6",
                        axis: "left",
                        data: membership.voltageMembership.map((d: any) => ({ x: d.x, y: d.high })),
                      },
                    ]}
                    legend={[
                      { label: "Low", color: "#EF4444" },
                      { label: "Normal", color: "#10B981" },
                      { label: "High", color: "#3B82F6" },
                    ]}
                  />
                )}
              </ChartCard>
              <ChartCard title="Power" chartId="chart-power-mf">
                {!membership ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <TimeSeriesChart
                    height={260}
                    spanHours={24}
                    xTickFormat={(d: Date) => String(d.getTime())}
                    tooltipDateFormat={(d: Date) => `Value: ${d.getTime()}`}
                    leftTickFormat={(v: number) => v.toFixed(1)}
                    leftDomain={[0, 1]}
                    series={[
                      {
                        id: "economical",
                        label: "Economical",
                        color: "#2ecc71",
                        axis: "left",
                        data: membership.powerMembership.map((d: any) => ({ x: d.x, y: d.economical })),
                      },
                      {
                        id: "normal",
                        label: "Normal",
                        color: "#3498db",
                        axis: "left",
                        data: membership.powerMembership.map((d: any) => ({ x: d.x, y: d.normal })),
                      },
                      {
                        id: "wasteful",
                        label: "Wasteful",
                        color: "#e74c3c",
                        axis: "left",
                        data: membership.powerMembership.map((d: any) => ({ x: d.x, y: d.wasteful })),
                      },
                    ]}
                    legend={[
                      { label: "Economical", color: "#2ecc71" },
                      { label: "Normal", color: "#3498db" },
                      { label: "Wasteful", color: "#e74c3c" },
                    ]}
                  />
                )}
              </ChartCard>
            </div>
          </MembershipPanel>
        </section>
      )}

      {/* ═════ CLIMATE FUZZY ═════ */}
      {activeTab === "climate-fuzzy" && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Climate Fuzzy Analysis
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Fuzzy inference for thermal comfort classification
              </p>
              <InfoTip
                title="ASHRAE 55 & SNI 03-6572"
                content="Based on ASHRAE 55-2020 and SNI 03-6572-2001. Adapted for naturally ventilated buildings in tropical climates. 14 rules across 2 input variables."
              />
            </div>
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
              action={
                <RangeFilter
                  from={climateFuzzyRange.from}
                  to={climateFuzzyRange.to}
                  onChange={(from, to) => setClimateFuzzyRange({ from, to })}
                />
              }
            >
              {climateFuzzyLoading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Loading...
                </div>
              ) : climatePieData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  No data
                </div>
              ) : (
                <NivoPieChart
                  data={climatePieData.map((d) => ({
                    id: d.name,
                    value: d.value,
                    color: d.color,
                  }))}
                  height={280}
                />
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
    </div>
  );
}