// apps/frontend/src/components/charts/TimeSeriesChart.tsx
// Nivo-based time series with dual Y-axes, gradient areas, dashed forecasts,
// confidence bands, "Now" marker and a merged crosshair tooltip.
import { useMemo, useId, type ReactNode } from "react";
import { ResponsiveLine } from "@nivo/line";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { useChartAnimation } from "@/hooks/useChartAnimation";

export interface SeriesPoint {
  x: number | string | Date;
  y: number | null;
}

export interface SeriesDef {
  id: string;
  label: string;
  color: string;
  axis: "left" | "right";
  data: SeriesPoint[];
  dashed?: boolean;
  area?: boolean;
  unit?: string;
}

export interface BandDef {
  axis: "left" | "right";
  upper: SeriesPoint[];
  lower: SeriesPoint[];
  color: string;
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

interface TimeSeriesChartProps {
  series: SeriesDef[];
  bands?: BandDef[];
  height?: number;
  spanHours?: number;
  xTickFormat?: (v: number) => string;
  tooltipDateFormat?: (v: number) => string;
  leftTickFormat?: (v: number) => string;
  rightTickFormat?: (v: number) => string;
  leftDomain?: [number, number] | "auto";
  rightDomain?: [number, number] | "auto";
  nowMarker?: string | null;
  legend?: LegendItem[];
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
}

const MARGIN = { top: 12, right: 56, bottom: 30, left: 56 };
const TO_MS = (x: number | string | Date) => (typeof x === "number" ? x : +new Date(x));

export function TimeSeriesChart({
  series,
  bands = [],
  height = 300,
  spanHours = 24,
  xTickFormat,
  tooltipDateFormat,
  leftTickFormat,
  rightTickFormat,
  leftDomain = "auto",
  rightDomain = "auto",
  nowMarker = null,
  legend = [],
  margin = MARGIN,
  className,
}: TimeSeriesChartProps) {
  const isDark = useIsDarkMode();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);
  const animate = useChartAnimation();
  const uid = useId();

  const leftSeries = series.filter((s) => s.axis === "left").map((s) => ({ ...s, data: s.data.map((d) => ({ x: TO_MS(d.x), y: d.y })) }));
  const rightSeries = series.filter((s) => s.axis === "right").map((s) => ({ ...s, data: s.data.map((d) => ({ x: TO_MS(d.x), y: d.y })) }));

  const allX = useMemo(() => {
    const xs: number[] = [];
    for (const s of series) for (const d of s.data) xs.push(TO_MS(d.x));
    for (const b of bands) { for (const d of b.upper) xs.push(TO_MS(d.x)); for (const d of b.lower) xs.push(TO_MS(d.x)); }
    return xs;
  }, [series, bands]);

  const xDomain: [number, number] = useMemo(() => {
    if (!allX.length) return [Date.now() - 86400000, Date.now()];
    const pad = (Math.max(...allX) - Math.min(...allX)) * 0.02 || 1000;
    return [Math.min(...allX) - pad, Math.max(...allX) + pad];
  }, [allX]);

  const yDomain = (items: typeof leftSeries, cfg: [number, number] | "auto"): [number, number] => {
    if (cfg !== "auto") return cfg;
    const vals = items.flatMap((s) => s.data.map((d) => d.y).filter((y): y is number => y != null));
    return vals.length ? [0, Math.max(...vals) * 1.1] : [0, 1];
  };

  const fmtX = (v: number) => (xTickFormat ? xTickFormat(v) : String(v));
  const fmtL = (v: number) => (leftTickFormat ? leftTickFormat(v) : String(v));
  const fmtR = (v: number) => (rightTickFormat ? rightTickFormat(v) : String(v));

  const leftScale = yDomain(leftSeries, leftDomain);
  const rightScale = yDomain(rightSeries, rightDomain);
  const leftBands = bands.filter((b) => b.axis === "left");
  const rightBands = bands.filter((b) => b.axis === "right");

  const dasi = new Set(series.filter((s) => s.dashed).map((s) => s.id));
  const areaIds = new Set(series.filter((s) => s.area).map((s) => s.id));

  /* ── Custom SVG layers ── */
  // BandLayer per axis: each chart renders its own bands
  const LeftBandLayer = ({ xScale: xs, yScale: ys }: any) => (
    <g>{leftBands.map((b, i) => {
      const pts: Array<[number, number]> = [
        ...b.upper.map((p) => [xs(TO_MS(p.x)), ys(p.y)] as [number, number]),
        ...[...b.lower].reverse().map((p) => [xs(TO_MS(p.x)), ys(p.y)] as [number, number]),
      ];
      if (!pts.length) return null;
      const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") + " Z";
      return <path key={`band-${i}`} d={d} fill={b.color} fillOpacity={0.12} stroke="none" />;
    })}</g>
  );
  const RightBandLayer = ({ xScale: xs, yScale: ys }: any) => (
    <g>{rightBands.map((b, i) => {
      const pts: Array<[number, number]> = [
        ...b.upper.map((p) => [xs(TO_MS(p.x)), ys(p.y)] as [number, number]),
        ...[...b.lower].reverse().map((p) => [xs(TO_MS(p.x)), ys(p.y)] as [number, number]),
      ];
      if (!pts.length) return null;
      const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") + " Z";
      return <path key={`band-${i}`} d={d} fill={b.color} fillOpacity={0.12} stroke="none" />;
    })}</g>
  );

  // AreaLayer: uses the chart's computed series (props) so only the chart's own axis areas are drawn
  const AreaLayer = ({ series: cs, xScale: xs, yScale: ys, innerHeight: ih }: any) => (
    <g>{cs.filter((s: any) => areaIds.has(s.id)).map((s: any) => {
      const pts = s.data.map((p: any) => ({ x: p.position.x, y: p.position.y })).filter((p: any) => p.y != null);
      if (pts.length < 2) return null;
      const line = pts.map((p: { x: number; y: number }) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("L");
      const base = Math.min(ys(0), ih); // clamp to plot bottom so areas don't overflow past the axis
      return <path key={s.id} d={`M${line}L${pts[pts.length - 1].x.toFixed(2)},${base.toFixed(2)}L${pts[0].x.toFixed(2)},${base.toFixed(2)}Z`} fill={`url(#${uid}-grad-${s.id})`} stroke="none" />;
    })}</g>
  );

  const LineLayer = ({ series: cs }: any) => (
    <g>{cs.map((s: any) => {
      const pts: Array<[number, number]> = s.data.map((p: any) => [p.position.x, p.position.y]).filter((p: [number, number]) => p[1] != null);
      if (pts.length < 2) return null;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
      const isDashed = dasi.has(s.id);
      return <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={isDashed ? "6 4" : undefined} />;
    })}</g>
  );

  // Gradient defs for area series
  const defs = series.filter((s) => s.area).map((s) => ({
    id: `${uid}-grad-${s.id}`,
    type: "linearGradient" as const,
    colors: [
      { offset: 0, color: s.color, opacity: 0.28 },
      { offset: 100, color: s.color, opacity: 0 },
    ],
  }));
  const fill = series.filter((s) => s.area).map((s) => ({ match: { id: s.id }, id: `${uid}-grad-${s.id}` }));

  const markers = nowMarker ? [{
    axis: "x" as const, value: +new Date(nowMarker), legend: "Now", legendPosition: "top-left" as const,
    lineStyle: { stroke: isDark ? "#6B7280" : "#9CA3AF", strokeWidth: 1, strokeDasharray: "4 4" },
    textStyle: { fill: isDark ? "#9CA3AF" : "#9CA3AF", fontSize: 10 },
  }] : [];

  /* Merged tooltip (inline component, hoisted via useMemo for identity stability) */
  const MergedTooltip = useMemo(() => {
    const TooltipFn = ({ slice }: { slice: any }) => {
      const xVal = slice?.points?.[0]?.data?.x;
      if (xVal == null) return null;
      const rows: Array<{ label: string; value: number | null; color: string; unit?: string }> = series
        .map((s) => {
          const pt = s.data.find((d) => Math.abs(TO_MS(d.x) - xVal) < 1);
          return { label: s.label, value: pt?.y ?? null, color: s.color, unit: s.unit };
        }).filter((r) => r.value != null);
      if (!rows.length) return null;
      const dateStr = tooltipDateFormat ? tooltipDateFormat(xVal) : xTickFormat ? xTickFormat(xVal) : new Date(xVal).toLocaleString();
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans">
          <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">{dateStr}</p>
          {rows.map((r) => (
            <p key={r.label} className="text-gray-400 dark:text-gray-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              {r.label}: <span className="text-gray-900 dark:text-white font-semibold">{typeof r.value === "number" ? Number(r.value.toFixed(2)) : r.value}{r.unit ? ` ${r.unit}` : ""}</span>
            </p>
          ))}
        </div>
      );
    };
    return TooltipFn;
  }, [series, tooltipDateFormat, xTickFormat]);

  const legendNode = legend.length ? (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
      {legend.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-[0px] border-t-2" style={{ borderColor: l.color, borderTopStyle: l.dashed ? "dashed" : "solid" }} />
          {l.label}
        </span>
      ))}
    </div>
  ) : null;

  const layers: any[] = ["grid", "markers", "axes", LeftBandLayer, AreaLayer, LineLayer, "crosshair", "slices", "points", "mesh", "legends"];
  const overlayLayers: any[] = ["grid", "markers", "axes", RightBandLayer, AreaLayer, LineLayer, "crosshair", "legends"];

  const cp: any = { theme, margin, animate, enablePoints: false, enableGridX: false, enableArea: false, enableSlices: false, defs, fill };

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        {/* Left-axis chart — interactive */}
        <div className="absolute inset-0">
          <ResponsiveLine
            data={leftSeries.map((s) => ({ id: s.id, data: s.data }))}
            {...cp}
            xScale={{ type: "linear", min: xDomain[0], max: xDomain[1] }}
            colors={leftSeries.map((s) => s.color)}
            yScale={{ type: "linear", min: leftScale[0], max: leftScale[1] }}
            enableGridY axisLeft={{ tickSize: 0, tickPadding: 8, format: fmtL, tickValues: 5 }}
            axisRight={null}
            axisBottom={{ tickSize: 0, tickPadding: 10, format: fmtX, tickValues: 5 }}
            markers={markers}
            enableSlices="x" isInteractive useMesh enableCrosshair
            layers={layers}
            sliceTooltip={MergedTooltip}
          />
        </div>
        {/* Right-axis chart — non-interactive overlay */}
        {rightSeries.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <ResponsiveLine
              data={rightSeries.map((s) => ({ id: s.id, data: s.data }))}
              {...cp}
              xScale={{ type: "linear", min: xDomain[0], max: xDomain[1] }}
              colors={rightSeries.map((s) => s.color)}
              yScale={{ type: "linear", min: rightScale[0], max: rightScale[1] }}
              enableGridY={false} axisLeft={null}
              axisRight={{ tickSize: 0, tickPadding: 8, format: fmtR, tickValues: 5 }}
              axisBottom={null}
              isInteractive={false}
              layers={overlayLayers}
            />
          </div>
        )}
      </div>
      {legendNode}
    </div>
  );
}