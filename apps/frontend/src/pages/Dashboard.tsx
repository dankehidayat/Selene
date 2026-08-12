// apps/frontend/src/pages/Dashboard.tsx
import { useMemo, useState } from "react";
import { Zap, Activity, Gauge, DollarSign } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";
import { StatCard, EST_COST_INFO } from "@/components/StatCard";
import {
  ChartCard,
  ToggleControl,
  ConfidencePill,
  ForecastLegendHint,
} from "@/components/ChartCard";
import { RangeBar } from "@/components/RangeBar";
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

export function Dashboard() {
  const [chartRange, setChartRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [showForecast, setShowForecast] = useState(false);
  const { user } = useAuth();

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

  return (
    <div className="space-y-8 font-sans">
      <LiveClock userName={user?.name} />

      <div className="flex justify-end">
        <RangeBar
          from={chartRange.from}
          to={chartRange.to}
          onChange={(from, to) => setChartRange({ from, to })}
        />
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
                xTickFormat={(v: number) => formatTick(new Date(v).toISOString(), chartSpanHours)}
                tooltipDateFormat={(v: number) => formatDateForTooltip(new Date(v).toISOString(), chartSpanHours)}
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
                xTickFormat={(v: number) => formatTick(new Date(v).toISOString(), chartSpanHours)}
                tooltipDateFormat={(v: number) => formatDateForTooltip(new Date(v).toISOString(), chartSpanHours)}
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
