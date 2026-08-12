// apps/frontend/src/components/charts/TimeSeriesChart.tsx
// Nivo-based time series with dual Y-axes, gradient areas, dashed forecasts,
// confidence bands, "Now" marker and a merged crosshair tooltip.
import { useMemo, type ReactNode } from "react";
import { ResponsiveLine } from "@nivo/line";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

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
  /** Solid line replaced with dashed stroke (forecast). */
  dashed?: boolean;
  /** Draw a soft gradient under the line. */
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
  /** Axis tick formatter (short). */
  xTickFormat?: (v: Date) => string;
  /** Tooltip header formatter (longer, may include "Predicted ·"). */
  tooltipDateFormat?: (v: Date) => string;
  leftTickFormat?: (v: number) => string;
  rightTickFormat?: (v: number) => string;
  leftDomain?: [number, number] | "auto";
  rightDomain?: [number, number] | "auto";
  /** ISO timestamp — draws a dashed "Now" reference line. */
  nowMarker?: string | null;
  legend?: LegendItem[];
  margin?: { top: number; right: number; bottom: number; left: number };
  className?: string;
}

const MARGIN = { top: 12, right: 56, bottom: 30, left: 56 };

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

  const leftSeries = series.filter((s) => s.axis === "left");
  const rightSeries = series.filter((s) => s.axis === "right");
  const leftBands = bands.filter((b) => b.axis === "left");
  const rightBands = bands.filter((b) => b.axis === "right");
  const dashedIds = new Set(series.filter((s) => s.dashed).map((s) => s.id));

  // Shared x domain across ALL series + bands (keeps both axes aligned).
  const allX = useMemo(() => {
    const xs = series.flatMap((s) => s.data.map((d) => +new Date(d.x)));
    for (const b of bands) {
      xs.push(...b.upper.map((d) => +new Date(d.x)));
      xs.push(...b.lower.map((d) => +new Date(d.x)));
    }
    return xs;
  }, [series, bands]);

  const xDomain: [number, number] = useMemo(() => {
    if (!allX.length) return [Date.now() - 86400000, Date.now()];
    const min = Math.min(...allX);
    const max = Math.max(...allX);
    const pad = (max - min) * 0.02 || 1000;
    return [min - pad, max + pad];
  }, [allX]);

  const toNivo = (s: SeriesDef) => ({
    id: s.id,
    data: s.data.map((d) => ({ x: +new Date(d.x), y: d.y })),
  });
  const leftData = leftSeries.map(toNivo);
  const rightData = rightSeries.map(toNivo);

  const yDomain = (items: SeriesDef[], cfg: [number, number] | "auto"): [number, number] => {
    if (cfg !== "auto") return cfg;
    const vals = items.flatMap((s) => s.data.map((d) => d.y).filter((y): y is number => y != null));
    if (!vals.length) return [0, 1];
    const max = Math.max(...vals);
    return [0, max > 0 ? max * 1.1 : 1];
  };
  const leftScale: [number, number] = yDomain(leftSeries, leftDomain);
  const rightScale: [number, number] = yDomain(rightSeries, rightDomain);

  const xScale = {
    type: "linear" as const,
    min: xDomain[0],
    max: xDomain[1],
  };

  const fmtX = (v: number) => (xTickFormat ? xTickFormat(new Date(v)) : String(v));
  const fmtL = (v: number) => (leftTickFormat ? leftTickFormat(v) : String(v));
  const fmtR = (v: number) => (rightTickFormat ? rightTickFormat(v) : String(v));

  // Defs + fill for gradient areas.
  const defs = series
    .filter((s) => s.area)
    .map((s) => ({
      id: `grad-${s.id}`,
      type: "linearGradient" as const,
      colors: [
        { offset: 0, color: s.color, opacity: 0.3 },
        { offset: 100, color: s.color, opacity: 0 },
      ],
    }));
  const fill = series
    .filter((s) => s.area)
    .map((s) => ({ match: { id: s.id }, id: `grad-${s.id}` }));

  // Custom layers: confidence bands + all lines (solid or dashed).
  const makeLayers = (bandList: BandDef[]) => {
    const BandLayer = (props: any) => {
      const { xScale: xs, yScale: ys } = props;
      return (
        <g>
          {bandList.map((b, i) => {
            const pts: Array<[number, number]> = [
              ...b.upper.map((p) => [xs(+new Date(p.x)), ys(p.y)] as [number, number]),
              ...[...b.lower].reverse().map((p) => [xs(+new Date(p.x)), ys(p.y)] as [number, number]),
            ];
            if (!pts.length) return null;
            const d =
              pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") +
              " Z";
            return (
              <path key={`band-${i}`} d={d} fill={b.color} fillOpacity={0.12} stroke="none" />
            );
          })}
        </g>
      );
    };

    const CustomLines = ({ series: cs }: any) => (
      <g>
        {cs.map((s: any) => {
          const pts: Array<[number, number]> = s.data.map((p: any) => [p.position.x, p.position.y]);
          if (!pts.length) return null;
          const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashedIds.has(s.id) ? "6 4" : undefined}
            />
          );
        })}
      </g>
    );

    return [
      "grid",
      "markers",
      "axes",
      "areas",
      BandLayer,
      CustomLines,
      "crosshair",
      "slices",
      "points",
      "mesh",
      "legends",
    ] as any[];
  };

  const leftLayers = useMemo(() => makeLayers(leftBands), [leftBands, dashedIds]);
  const rightLayers = useMemo(() => makeLayers(rightBands), [rightBands, dashedIds]);

  const markers = nowMarker
    ? [
        {
          axis: "x" as const,
          value: +new Date(nowMarker),
          legend: "Now",
          legendPosition: "top-left" as const,
          lineStyle: { stroke: isDark ? "#6B7280" : "#9CA3AF", strokeWidth: 1, strokeDasharray: "4 4" },
          textStyle: { fill: isDark ? "#9CA3AF" : "#9CA3AF", fontSize: 10 },
        },
      ]
    : [];

  const renderTooltip = (slice: any): ReactNode => {
    const xVal = slice?.points?.[0]?.data?.x;
    if (xVal == null) return null;
    const rows: Array<{ label: string; value: number | null; color: string; unit?: string }> = series
      .map((s) => {
        const pt = s.data.find((d) => Math.abs(+new Date(d.x) - xVal) < 1);
        return { label: s.label, value: pt?.y ?? null, color: s.color, unit: s.unit };
      })
      .filter((r) => r.value != null);
    if (!rows.length) return null;

    const dateStr = tooltipDateFormat
      ? tooltipDateFormat(new Date(xVal))
      : xTickFormat
        ? xTickFormat(new Date(xVal))
        : new Date(xVal).toLocaleString();

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans">
        <p className="text-gray-400 dark:text-gray-400 mb-1.5 font-medium">{dateStr}</p>
        {rows.map((r) => (
          <p key={r.label} className="text-gray-400 dark:text-gray-400 flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: r.color }}
            />
            {r.label}:{" "}
            <span className="text-gray-900 dark:text-white font-semibold">
              {typeof r.value === "number" ? Number(r.value.toFixed(2)) : r.value}
              {r.unit ? ` ${r.unit}` : ""}
            </span>
          </p>
        ))}
      </div>
    );
  };

  const legendNode = legend.length ? (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
      {legend.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-4 h-0 border-t-2"
            style={{ borderColor: l.color, borderTopStyle: l.dashed ? "dashed" : "solid" }}
          />
          {l.label}
        </span>
      ))}
    </div>
  ) : null;

  const commonProps = {
    xScale,
    curve: "monotoneX" as const,
    theme,
    margin,
    animate: true,
    enablePoints: false,
    enableGridX: false,
    enableArea: true,
    areaOpacity: 1,
    defs,
    fill,
    useMesh: false,
  };

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        {/* Left-axis chart — interactive, owns grid + x axis + tooltip */}
        <div className="absolute inset-0">
          <ResponsiveLine
            data={leftData}
            {...commonProps}
            colors={leftSeries.map((s) => s.color)}
            yScale={{ type: "linear", min: leftScale[0], max: leftScale[1] }}
            enableGridY
            axisLeft={{ tickSize: 0, tickPadding: 8, format: fmtL, tickValues: 5 }}
            axisRight={null}
            axisBottom={{ tickSize: 0, tickPadding: 10, format: fmtX, tickValues: 5 }}
            markers={markers}
            enableSlices="x"
            isInteractive
            useMesh
            layers={leftLayers}
            sliceTooltip={renderTooltip as any}
          />
        </div>
        {/* Right-axis chart — pure overlay, non-interactive */}
        {rightSeries.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <ResponsiveLine
              data={rightData}
              {...commonProps}
              colors={rightSeries.map((s) => s.color)}
              yScale={{ type: "linear", min: rightScale[0], max: rightScale[1] }}
              enableGridY={false}
              axisLeft={null}
              axisRight={{ tickSize: 0, tickPadding: 8, format: fmtR, tickValues: 5 }}
              axisBottom={null}
              isInteractive={false}
              layers={rightLayers}
            />
          </div>
        )}
      </div>
      {legendNode}
    </div>
  );
}