// apps/frontend/src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import {
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
import { Zap, Activity, Gauge, DollarSign, Info, Clock } from "lucide-react";
import { StatCard, EST_COST_INFO } from "@/components/StatCard";
import { ChartCard, RangeSelect, ToggleControl } from "@/components/ChartCard";
import { PowerOverview } from "@/components/PowerOverview";
import { ClimateOverview } from "@/components/ClimateOverview";
import { StableResponsiveContainer as ResponsiveContainer } from "@/components/StableResponsiveContainer";
import {
  useLiveReading,
  useReadingHistory,
  useAnalyticsSummary,
} from "@/services/api";
import { useAuth } from "@/services/auth";
import { ensembleForecast, confidenceBands } from "@/lib/forecast";
import { computeDomain } from "@/lib/chartDomain";
import { useChartMaxPoints } from "@/hooks/useChartMaxPoints";

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

/** Drop Area fill twins (raw dataKey labels) so only Line series show. */
function uniqueTooltipRows(
  payload?: Array<{
    value?: number;
    name?: string;
    color?: string;
    dataKey?: string | number;
    stroke?: string;
    fill?: string;
    hide?: boolean;
  }>,
) {
  if (!payload?.length) return [];
  const byKey = new Map<string, (typeof payload)[number]>();
  for (const e of payload) {
    if (e == null || e.value == null || e.hide) continue;
    const dataKey = String(e.dataKey ?? e.name ?? "");
    const name = String(e.name ?? dataKey);
    const isRaw = name === dataKey || name === dataKey.toLowerCase();
    const isFillOnly =
      (e.stroke === "none" || e.stroke === undefined) &&
      !!e.fill &&
      e.fill !== "none";
    if (isFillOnly && isRaw) continue;
    if (isRaw && !e.stroke) continue;
    const key = dataKey || name;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, e);
      continue;
    }
    const prevRaw =
      String(prev.name) === String(prev.dataKey) ||
      String(prev.name) === String(prev.dataKey).toLowerCase();
    if (!isRaw && prevRaw) byKey.set(key, e);
  }
  return Array.from(byKey.values()).filter(
    (e) =>
      typeof e.name === "string" &&
      e.name.length > 0 &&
      e.name !== String(e.dataKey),
  );
}

function unitForSeries(name: string): string {
  if (/\([^)]+\)/.test(name)) return "";
  if (/current/i.test(name)) return "A";
  if (/temp/i.test(name)) return "°C";
  if (/humid/i.test(name)) return "%";
  if (/power/i.test(name)) return "W";
  return "";
}

function UnifiedTooltip({
  active,
  payload,
  label,
  range,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey?: string;
    stroke?: string;
    fill?: string;
  }>;
  label?: string;
  range: string;
}) {
  const rows = uniqueTooltipRows(payload);
  if (!active || !rows.length || !label) return null;
  return (
    <div className={TC}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {rows.map((e) => {
        const unit = unitForSeries(String(e.name));
        const color = e.color || e.stroke || "#6B7280";
        return (
          <p
            key={e.name}
            className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            {e.name}:{" "}
            <span className="text-gray-900 dark:text-white font-semibold">
              {e.value}
              {unit ? ` ${unit}` : ""}
            </span>
          </p>
        );
      })}
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
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey?: string;
    stroke?: string;
    fill?: string;
  }>;
  label?: string;
  range: string;
}) {
  const rows = uniqueTooltipRows(payload);
  if (!active || !rows.length || !label) return null;
  return (
    <div className={TC}>
      <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">
        {formatDateForTooltip(label, range)}
      </p>
      {rows.map((e) => {
        const unit = unitForSeries(String(e.name));
        const color = e.color || e.stroke || "#6B7280";
        return (
          <p
            key={e.name}
            className="text-gray-400 dark:text-gray-400 flex items-center gap-2"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            {e.name}:{" "}
            <span className="text-gray-900 dark:text-white font-semibold">
              {e.value}
              {unit ? ` ${unit}` : ""}
            </span>
          </p>
        );
      })}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Rotating dashboard taglines — stable per calendar day. */
const GREETING_MESSAGES = [
  "Review today's energy patterns and plan for tomorrow.",
  "Start your day with insights into your energy usage.",
  "Monitor power consumption and environmental conditions.",
  "A calm dashboard for a clearer view of your fleet.",
  "Small watts add up — see where the day is going.",
  "Track the grid, the room, and the story between them.",
  "Live readings when you need them; history when you dig deeper.",
  "Keep an eye on peaks, comfort, and quiet efficiency.",
  "Your sensors are talking — here's the plain-language summary.",
  "Steady power and comfortable air: today's twin goals.",
  "Glance at the numbers, then decide what needs attention.",
  "From Jakarta nights to office afternoons — one place to check in.",
  "Efficiency is a habit; this page helps you keep it.",
  "When the load spikes, you'll see it here first.",
  "Climate and current on the same stage — take a seat.",
  "Plan the next shift with yesterday's peaks still in mind.",
  "Good data, fewer surprises — welcome back.",
  "A quiet pulse of telemetry so you don't have to guess.",
  "Tune the room, respect the grid, enjoy the clarity.",
  "Every chart is a conversation with your building.",
  "Fresh metrics for a focused hour of work.",
  "Watch frequency stay on beat and comfort stay kind.",
  "Energy is a budget — spend it where it matters.",
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
  const [chartRange, setChartRange] = useState<string>("24h");
  const [showForecast, setShowForecast] = useState(false);
  const { user } = useAuth();
  const nowClock = useNow(1000);
  const tagline = useMemo(() => getGreetingMessage(), []);

  // ── SSE Live Data ────────────────────────────────────
  const { data: live } = useLiveReading();
  const chartMaxPoints = useChartMaxPoints();

  // Stage 1: summary (cheap CAGG path) — paints stat cards first
  const {
    data: summary,
    isSuccess: summaryReady,
    isError: summaryFailed,
    isLoading: summaryLoading,
  } = useAnalyticsSummary("24h");
  // Stage 2: chart series after summary (or if summary fails) + pixel budget
  const chartsReady = summaryReady || summaryFailed || !summaryLoading;
  const { data: history = [], isFetching: historyFetching } = useReadingHistory(
    chartRange as any,
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
          {showConf && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {Math.round((avgConf / 4) * 100)}% confidence
            </span>
          )}
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
            infoTitle={EST_COST_INFO.title}
            infoContent={EST_COST_INFO.content}
          />
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <ChartCard
            title="Energy Usage"
            chartId="chart-energy-usage"
            action={
              <div className="flex items-center gap-2">
                <ToggleControl
                  pressed={showForecast}
                  onPressedChange={setShowForecast}
                >
                  Forecast
                </ToggleControl>
                <RangeSelect
                  options={RANGE_OPTIONS}
                  value={chartRange}
                  onChange={setChartRange}
                  labels={RANGE_LABELS}
                />
              </div>
            }
          >
            {history.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                {historyFetching || !chartsReady ? "Loading…" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={300}
                className={historyFetching ? "opacity-70 transition-opacity" : undefined}
              >
                <ComposedChart data={history} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.32}
                      />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#F59E0B"
                        stopOpacity={0.32}
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
                    domain={powerDomain}
                    allowDataOverflow={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    domain={currentDomain}
                    allowDataOverflow={false}
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
                      tooltipType="none"
                      legendType="none"
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
                      tooltipType="none"
                      legendType="none"
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
                      tooltipType="none"
                      legendType="none"
                      fill="url(#pfb)"
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
                      tooltipType="none"
                      legendType="none"
                      fill="url(#cfb)"
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
          {showConf && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {Math.round((avgConf / 4) * 100)}% confidence
            </span>
          )}
        </div>
        {showForecast && (
          <div className="mb-3">
            <ForecastBanner />
          </div>
        )}
        <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
          <ChartCard
            title="Climate History"
            chartId="chart-climate"
            action={
              <div className="flex items-center gap-2">
                <ToggleControl
                  pressed={showForecast}
                  onPressedChange={setShowForecast}
                >
                  Forecast
                </ToggleControl>
                <RangeSelect
                  options={RANGE_OPTIONS}
                  value={chartRange}
                  onChange={setChartRange}
                  labels={RANGE_LABELS}
                />
              </div>
            }
          >
            {ch.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={ch} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#EF4444"
                        stopOpacity={0.32}
                      />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity={0.32}
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
                    domain={tempDomain}
                    allowDataOverflow={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={CF}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    domain={humidityDomain}
                    allowDataOverflow={false}
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
                      tooltipType="none"
                      legendType="none"
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
                      tooltipType="none"
                      legendType="none"
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
                      tooltipType="none"
                      legendType="none"
                      fill="url(#tfb)"
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
                      tooltipType="none"
                      legendType="none"
                      fill="url(#hfb)"
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
