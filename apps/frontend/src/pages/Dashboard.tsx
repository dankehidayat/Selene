// apps/frontend/src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Zap, Activity, Gauge, DollarSign, Clock } from "lucide-react";
import { StatCard, EST_COST_INFO } from "@/components/StatCard";
import {
  ChartCard,
  ToggleControl,
  ConfidencePill,
  ForecastLegendHint,
} from "@/components/ChartCard";
import { RangeFilter } from "@/components/RangeFilter";
import { PowerOverview } from "@/components/PowerOverview";
import { ClimateOverview } from "@/components/ClimateOverview";
import {
  useLiveReading,
  useReadingHistory,
  useAnalyticsSummary,
} from "@/services/api";
import { useAuth } from "@/services/auth";
import { ensembleForecast, confidenceBands } from "@/lib/forecast";
import { computeDomain } from "@/lib/chartDomain";
import { useChartMaxPoints } from "@/hooks/useChartMaxPoints";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Rotating dashboard taglines, stable per calendar day. */
const GREETING_MESSAGES = [
  "Review today's energy patterns and plan for tomorrow.",
  "Start your day with insights into your energy usage.",
  "Monitor power consumption and environmental conditions.",
  "A calm dashboard for a clearer view of your fleet.",
  "Small watts add up. See where the day is going.",
  "Track the grid, the room, and the story between them.",
  "Live readings when you need them; history when you dig deeper.",
  "Keep an eye on peaks, comfort, and quiet efficiency.",
  "Your sensors are talking. Here's the plain-language summary.",
  "Steady power and comfortable air: today's twin goals.",
  "Glance at the numbers, then decide what needs attention.",
  "From Jakarta nights to office afternoons, one place to check in.",
  "Efficiency is a habit; this page helps you keep it.",
  "When the load spikes, you'll see it here first.",
  "Climate and current on the same stage. Take a seat.",
  "Plan the next shift with yesterday's peaks still in mind.",
  "Good data, fewer surprises. Welcome back.",
  "A quiet pulse of telemetry so you don't have to guess.",
  "Tune the room, respect the grid, enjoy the clarity.",
  "Every chart is a conversation with your building.",
  "Fresh metrics for a focused hour of work.",
  "Watch frequency stay on beat and comfort stay kind.",
  "Energy is a budget. Spend it where it matters.",
  "The moon watches overnight; Selene keeps the lights honest.",
  "Open the day with voltage, close it with a clear summary.",
  "Insights first, deep analytics when you're ready.",
  "Healthy loads make for healthier offices.",
  "See the pattern before it becomes a problem.",
  "One dashboard, many sensors, zero drama (hopefully).",
  "Stay curious about the watts behind the work.",
] as const;

function getGreetingMessage(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  return GREETING_MESSAGES[day % GREETING_MESSAGES.length];
}

const JAKARTA_TZ = "Asia/Jakarta";

function formatClock(date: Date, timeZone?: string): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatClockDate(date: Date, timeZone?: string): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

function useNow(tickMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

export function Dashboard() {
  const [chartRange, setChartRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [showForecast, setShowForecast] = useState(false);
  const { user } = useAuth();
  const nowClock = useNow(1000);
  const tagline = useMemo(() => getGreetingMessage(), []);

  // ── SSE Live Data ────────────────────────────────────
  const { data: live } = useLiveReading();
  const chartMaxPoints = useChartMaxPoints();
  const chartSpanHours = (() => {
    if (chartRange.from && chartRange.to) {
      return (new Date(chartRange.to).getTime() - new Date(chartRange.from).getTime()) / 3600000;
    }
    return 24;
  })();
  const chartQuery = chartRange.from
    ? { from: chartRange.from, to: chartRange.to! }
    : { range: "24h" };

  // Stage 1: summary (cheap CAGG path) — paints stat cards first
  const {
    data: summary,
    isSuccess: summaryReady,
    isError: summaryFailed,
    isLoading: summaryLoading,
  } = useAnalyticsSummary(chartQuery);
  // Stage 2: chart series after summary (or if summary fails) + pixel budget
  const chartsReady = summaryReady || summaryFailed || !summaryLoading;
  const { data: history = [], isFetching: historyFetching } = useReadingHistory(
    chartQuery,
    chartsReady,
    chartMaxPoints,
  );
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
        chartRange.from ? { from: chartRange.from, to: chartRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const cfc = showForecast
    ? ensembleForecast(
        history.map((h: any) => ({ timestamp: h.timestamp, value: h.current })),
        chartRange.from ? { from: chartRange.from, to: chartRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const tf = showForecast
    ? ensembleForecast(
        ch.map((h: any) => ({ timestamp: h.timestamp, value: h.temperature })),
        chartRange.from ? { from: chartRange.from, to: chartRange.to! } : "24h",
      )
    : { forecast: [], confidence: 0 };
  const hf = showForecast
    ? ensembleForecast(
        ch.map((h: any) => ({ timestamp: h.timestamp, value: h.humidity })),
        chartRange.from ? { from: chartRange.from, to: chartRange.to! } : "24h",
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

  // Explicit domains from actual + forecast so lines aren't clipped/overscaled
  const powerDomain = useMemo(
    () =>
      computeDomain(
        [
          ...history.map((h: any) => h.power),
          ...pf.forecast.map((f) => f.value),
          ...pb.upper.map((f) => f.value),
          ...pb.lower.map((f) => f.value),
        ],
        { floor: 0, pad: 0.1, minPad: 1 },
      ),
    [history, pf.forecast, pb.upper, pb.lower],
  );
  const currentDomain = useMemo(
    () =>
      computeDomain(
        [
          ...history.map((h: any) => h.current),
          ...cfc.forecast.map((f) => f.value),
          ...cb.upper.map((f) => f.value),
          ...cb.lower.map((f) => f.value),
        ],
        { floor: 0, pad: 0.1, minPad: 0.05 },
      ),
    [history, cfc.forecast, cb.upper, cb.lower],
  );
  const tempDomain = useMemo(
    () =>
      computeDomain(
        [
          ...ch.map((h: any) => h.temperature),
          ...tf.forecast.map((f) => f.value),
          ...tb.upper.map((f) => f.value),
          ...tb.lower.map((f) => f.value),
        ],
        { pad: 0.12, minPad: 0.5 },
      ),
    [ch, tf.forecast, tb.upper, tb.lower],
  );
  const humidityDomain = useMemo(
    () =>
      computeDomain(
        [
          ...ch.map((h: any) => h.humidity),
          ...hf.forecast.map((f) => f.value),
          ...hb.upper.map((f) => f.value),
          ...hb.lower.map((f) => f.value),
        ],
        { floor: 0, ceil: 100, pad: 0.08, minPad: 1 },
      ),
    [ch, hf.forecast, hb.upper, hb.lower],
  );

  const localTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "Local";

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {getGreeting()}
          {user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {tagline}
        </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm px-3 py-2">
            <Clock size={14} className="text-blue-500 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Your time
              </p>
              <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {formatClock(nowClock)}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatClockDate(nowClock)}
                {localTz ? ` · ${localTz}` : ""}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm px-3 py-2">
            <Clock size={14} className="text-violet-500 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Jakarta (WIB)
              </p>
              <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {formatClock(nowClock, JAKARTA_TZ)}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatClockDate(nowClock, JAKARTA_TZ)} · WIB (UTC+7)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Energy */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Energy
          </p>
        </div>
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
            infoTitle={EST_COST_INFO.title}
            infoContent={EST_COST_INFO.content}
          />
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <ChartCard
            title="Energy Usage"
            chartId="chart-energy-usage"
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showForecast && <ForecastLegendHint />}
                {showConf && (
                  <ConfidencePill percent={Math.round((avgConf / 4) * 100)} />
                )}
                <ToggleControl
                  pressed={showForecast}
                  onPressedChange={setShowForecast}
                >
                  Forecast
                </ToggleControl>
                <RangeFilter
                  from={chartRange.from}
                  to={chartRange.to}
                  onChange={(from, to) => setChartRange({ from, to })}
                />
              </div>
            }
          >
            {history.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                {historyFetching || !chartsReady ? "Loading…" : "No data"}
              </div>
            ) : (
              <TimeSeriesChart
                height={300}
                spanHours={chartSpanHours}
                xTickFormat={(d: Date) => formatTick(d.toISOString(), chartSpanHours)}
                tooltipDateFormat={(d: Date) => formatDateForTooltip(d.toISOString(), chartSpanHours)}
                leftTickFormat={(v: number) => String(v)}
                rightTickFormat={(v: number) => String(v)}
                leftDomain={[powerDomain[0], powerDomain[1]]}
                rightDomain={[currentDomain[0], currentDomain[1]]}
                nowMarker={pf?.forecast?.length ? new Date().toISOString() : null}
                className={historyFetching ? "opacity-70 transition-opacity" : undefined}
                series={[
                  { id: "power", label: "Power (W)", color: "#3B82F6", axis: "left", data: history.map((h: any) => ({ x: h.timestamp, y: h.power })), area: true },
                  { id: "current", label: "Current (A)", color: "#F59E0B", axis: "right", data: history.map((h: any) => ({ x: h.timestamp, y: h.current })), area: true },
                  ...(pf.forecast.length > 0
                    ? [{ id: "pf", label: "P. Forecast", color: "#3B82F6", axis: "left" as const, data: pf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })), dashed: true }]
                    : []),
                  ...(cfc.forecast.length > 0
                    ? [{ id: "cf", label: "C. Forecast", color: "#F59E0B", axis: "right" as const, data: cfc.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })), dashed: true }]
                    : []),
                ]}
                bands={[
                  ...(pb.upper.length > 0
                    ? [{ axis: "left" as const, upper: pb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })), lower: pb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })), color: "#3B82F6" }]
                    : []),
                  ...(cb.upper.length > 0
                    ? [{ axis: "right" as const, upper: cb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })), lower: cb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })), color: "#F59E0B" }]
                    : []),
                ]}
                legend={[
                  { label: "Power (W)", color: "#3B82F6" },
                  { label: "Current (A)", color: "#F59E0B" },
                  ...(pf.forecast.length > 0 ? [{ label: "P. Forecast", color: "#3B82F6", dashed: true }] : []),
                  ...(cfc.forecast.length > 0 ? [{ label: "C. Forecast", color: "#F59E0B", dashed: true }] : []),
                ]}
              />
            )}
          </ChartCard>
          <ChartCard title="Power Overview">
            <PowerOverview
              qualityScore={live?.powerQualityScore}
              cosPhi={live?.cosPhi}
              frequency={live?.frequency}
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
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <ChartCard
            title="Climate History"
            chartId="chart-climate"
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {showForecast && <ForecastLegendHint />}
                {showConf && (
                  <ConfidencePill percent={Math.round((avgConf / 4) * 100)} />
                )}
                <ToggleControl
                  pressed={showForecast}
                  onPressedChange={setShowForecast}
                >
                  Forecast
                </ToggleControl>
                <RangeFilter
                  from={chartRange.from}
                  to={chartRange.to}
                  onChange={(from, to) => setChartRange({ from, to })}
                />
              </div>
            }
          >
            {ch.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data
              </div>
            ) : (
              <TimeSeriesChart
                height={260}
                spanHours={chartSpanHours}
                xTickFormat={(d: Date) => formatTick(d.toISOString(), chartSpanHours)}
                tooltipDateFormat={(d: Date) => formatDateForTooltip(d.toISOString(), chartSpanHours)}
                leftTickFormat={(v: number) => String(v)}
                rightTickFormat={(v: number) => String(v)}
                leftDomain={[tempDomain[0], tempDomain[1]]}
                rightDomain={[humidityDomain[0], humidityDomain[1]]}
                nowMarker={tf?.forecast?.length ? new Date().toISOString() : null}
                series={[
                  { id: "temp", label: "Temperature (°C)", color: "#EF4444", axis: "left", data: ch.map((h: any) => ({ x: h.timestamp, y: h.temperature })), area: true },
                  { id: "hum", label: "Humidity (%)", color: "#3B82F6", axis: "right", data: ch.map((h: any) => ({ x: h.timestamp, y: h.humidity })), area: true },
                  ...(tf.forecast.length > 0
                    ? [{ id: "tf", label: "T. Forecast", color: "#EF4444", axis: "left" as const, data: tf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })), dashed: true }]
                    : []),
                  ...(hf.forecast.length > 0
                    ? [{ id: "hf", label: "H. Forecast", color: "#3B82F6", axis: "right" as const, data: hf.forecast.map((f: any) => ({ x: f.timestamp, y: f.value })), dashed: true }]
                    : []),
                ]}
                bands={[
                  ...(tb.upper.length > 0
                    ? [{ axis: "left" as const, upper: tb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })), lower: tb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })), color: "#EF4444" }]
                    : []),
                  ...(hb.upper.length > 0
                    ? [{ axis: "right" as const, upper: hb.upper.map((f: any) => ({ x: f.timestamp, y: f.value })), lower: hb.lower.map((f: any) => ({ x: f.timestamp, y: f.value })), color: "#3B82F6" }]
                    : []),
                ]}
                legend={[
                  { label: "Temperature (°C)", color: "#EF4444" },
                  { label: "Humidity (%)", color: "#3B82F6" },
                  ...(tf.forecast.length > 0 ? [{ label: "T. Forecast", color: "#EF4444", dashed: true }] : []),
                  ...(hf.forecast.length > 0 ? [{ label: "H. Forecast", color: "#3B82F6", dashed: true }] : []),
                ]}
              />
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
