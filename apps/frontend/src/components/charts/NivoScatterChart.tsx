// apps/frontend/src/components/charts/NivoScatterChart.tsx
import { useMemo, useCallback } from "react";
import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import { CartesianMarkerProps } from "@nivo/core";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

export type ScatterSymbol = "circle" | "square" | "diamond" | "triangle";

export interface ScatterSeries {
  id: string;
  label: string;
  color: string;
  data: Array<{ x: number; y: number }>;
  /** Per-series fill opacity (default 1). */
  opacity?: number;
  /** Per-series symbol (overrides the chart-level `symbol`). */
  symbol?: ScatterSymbol;
}

export interface NivoScatterChartProps {
  series: ScatterSeries[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xDomain?: [number, number] | "auto";
  yDomain?: [number, number] | "auto";
  markers?: Array<{
    axis: "x" | "y";
    value: number;
    color: string;
    label?: string;
    dashed?: boolean;
  }>;
  nodeSize?: number;
  symbol?: ScatterSymbol;
  tooltip?: (datum: any) => React.ReactNode;
}

/** Resolve a possibly-spring animated value to a plain number. */
function val(v: any): number {
  if (v == null) return 0;
  return typeof v.to === "function" ? v.to() : (v as number);
}

/** SVG shape for a scatter node. Looks up per-series symbol/opacity. */
function SymbolNode({
  getSymbol,
  getOpacity,
}: {
  getSymbol: (serieId: string | number) => ScatterSymbol;
  getOpacity: (serieId: string | number) => number;
}) {
  return useCallback(
    ({ node, style }: any) => {
      const cx = val(style.x);
      const cy = val(style.y);
      const size = val(style.size);
      const color = typeof (style.color as any)?.to === "function"
        ? (style.color as any).to()
        : (style.color as string);
      const r = size;
      const half = r / 2;
      const symbol = getSymbol(node.serieId);
      const opacity = getOpacity(node.serieId);
      const common = { opacity, style: { mixBlendMode: "normal" as const } };

      switch (symbol) {
        case "square":
          return (
            <rect
              x={cx - half}
              y={cy - half}
              width={r}
              height={r}
              rx={1}
              fill={color}
              {...common}
            />
          );
        case "diamond":
          return (
            <polygon
              points={`${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`}
              fill={color}
              {...common}
            />
          );
        case "triangle":
          return (
            <polygon
              points={`${cx},${cy - half} ${cx + half * 0.866},${cy + half * 0.5} ${cx - half * 0.866},${cy + half * 0.5}`}
              fill={color}
              {...common}
            />
          );
        default:
          return (
            <circle cx={cx} cy={cy} r={r / 2} fill={color} {...common} />
          );
      }
    },
    [getSymbol, getOpacity],
  );
}

export function NivoScatterChart({
  series,
  height = 350,
  xLabel,
  yLabel,
  xDomain = "auto",
  yDomain = "auto",
  markers,
  nodeSize = 9,
  symbol = "circle",
  tooltip,
}: NivoScatterChartProps) {
  const isDark = useIsDarkMode();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);

  const xScaleSpec = useMemo(() => {
    if (xDomain === "auto") return { type: "linear" as const };
    return { type: "linear" as const, min: xDomain[0], max: xDomain[1] };
  }, [xDomain]);

  const yScaleSpec = useMemo(() => {
    if (yDomain === "auto") return { type: "linear" as const };
    return { type: "linear" as const, min: yDomain[0], max: yDomain[1] };
  }, [yDomain]);

  const nivoData = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        data: s.data.map((d) => ({ x: d.x, y: d.y })),
      })),
    [series],
  );

  const colorOf = useCallback(
    (d: { serieId: string | number }) =>
      series.find((s) => s.id === d.serieId)?.color ?? "#666",
    [series],
  );
  const symbolOf = useCallback(
    (serieId: string | number) =>
      series.find((s) => s.id === serieId)?.symbol ?? symbol,
    [series, symbol],
  );
  const opacityOf = useCallback(
    (serieId: string | number) =>
      series.find((s) => s.id === serieId)?.opacity ?? 1,
    [series],
  );

  const nivoMarkers: CartesianMarkerProps<number>[] | undefined = useMemo(
    () =>
      markers?.map((m) => ({
        axis: m.axis,
        value: m.value,
        legend: m.label ?? "",
        lineStyle: {
          stroke: m.color,
          strokeWidth: m.dashed ? 1.5 : 2,
          strokeDasharray: m.dashed ? "6,3" : undefined,
        },
        textStyle: {
          fill: m.color,
          fontSize: 10,
          fontFamily: "Inter, sans-serif",
        },
      })),
    [markers],
  );

  const defaultTooltip = useCallback(
    ({ node }: any) => (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans">
        <p className="text-gray-400 dark:text-gray-400">
          {node.serieId}:{" "}
          <span className="text-gray-900 dark:text-white font-semibold">
            x={node.formattedX}, y={node.formattedY}
          </span>
        </p>
      </div>
    ),
    [],
  );

  const nodeComp = useMemo(
    () => SymbolNode({ getSymbol: symbolOf, getOpacity: opacityOf }),
    [symbolOf, opacityOf],
  );

  return (
    <div style={{ height }}>
      <ResponsiveScatterPlot
        data={nivoData}
        theme={theme}
        margin={{ top: 8, right: 16, bottom: 38, left: 52 }}
        xScale={xScaleSpec}
        yScale={yScaleSpec}
        colors={colorOf}
        nodeSize={nodeSize}
        nodeComponent={nodeComp}
        enableGridX
        enableGridY
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          legend: xLabel,
          legendPosition: "middle",
          legendOffset: 28,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          legend: yLabel,
          legendPosition: "middle",
          legendOffset: -40,
        }}
        useMesh
        isInteractive
        tooltip={tooltip ? ({ node }) => tooltip(node) : defaultTooltip}
        markers={nivoMarkers}
        animate
        motionConfig="gentle"
        role="application"
      />
    </div>
  );
}