// apps/frontend/src/components/charts/NivoBoxPlot.tsx
// Custom SVG box-and-whisker chart themed like the other Nivo charts.
// Uses @nivo/scales band + linear scales under the hood, but renders plain SVG
// so we are not tied to a Nivo box-plot package.
import { useMemo, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { useChartWidth } from "@/hooks/useChartWidth";
import { ChartTooltipCard, formatTooltipValue, TooltipHeader, TooltipRow } from "./ChartTooltip";
import { ChartReadout } from "./ChartReadout";

export interface NivoBoxPlotDatum {
  value: number;
  category: string;
}

export interface NivoBoxPlotProps {
  data: NivoBoxPlotDatum[];
  categories: string[];
  colors: Record<string, string>;
  height?: number;
  xLabel?: string;
  yLabel?: string;
}

interface BoxStats {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  values: number[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeStats(category: string, values: number[]): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    category,
    min: sorted[0],
    q1: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    q3: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
    values: sorted,
  };
}

const MARGIN = { top: 10, right: 16, bottom: 40, left: 56 };
const NARROW_BREAKPOINT = 480;

export function NivoBoxPlot({
  data,
  categories,
  colors,
  height = 280,
  xLabel = "Power (W)",
  yLabel,
}: NivoBoxPlotProps) {
  const isDark = useIsDarkMode();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);
  const [hovered, setHovered] = useState<string | null>(null);

  const [containerRef, width] = useChartWidth<HTMLDivElement>();
  const isNarrow = width > 0 && width < NARROW_BREAKPOINT;

  const boxes = useMemo(
    () =>
      categories
        .map((cat) => {
          const values = data
            .filter((d) => d.category === cat)
            .map((d) => d.value);
          return values.length ? computeStats(cat, values) : null;
        })
        .filter((b): b is BoxStats => b !== null),
    [data, categories],
  );

  const allValues = useMemo(
    () => boxes.flatMap((b) => b.values),
    [boxes],
  );
  const yDomain = useMemo(() => {
    if (!allValues.length) return [0, 1];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.1 || 1;
    return [Math.max(0, min - pad), max + pad];
  }, [allValues]);

  const widthViewBox = 560;
  const innerWidth = widthViewBox - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () =>
      scaleBand<string>()
        .domain(categories)
        .range([0, innerWidth])
        .paddingInner(0.4)
        .paddingOuter(0.2),
    [categories, innerWidth],
  );
  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain(yDomain as [number, number])
        .range([innerHeight, 0])
        .nice(),
    [yDomain, innerHeight],
  );

  const axisTextFill = theme.axis?.ticks?.text?.fill ?? "#9CA3AF";
  const axisFont = theme.axis?.ticks?.text?.fontSize ?? 11;
  const gridStroke = theme.grid?.line?.stroke ?? (isDark ? "#374151" : "#E5E7EB");
  const gridOpacity = theme.grid?.line?.strokeOpacity ?? 0.35;

  const xTicks = xScale.domain().map((cat) => ({
    cat,
    x: (xScale(cat) ?? 0) + xScale.bandwidth() / 2,
  }));

  const yTicks = yScale.ticks(5).map((v) => ({ v, y: yScale(v) }));

  const hoveredBox = hovered ? boxes.find((b) => b.category === hovered) ?? null : null;
  const readoutRows = hoveredBox
    ? [
        { label: "Min", value: formatTooltipValue(hoveredBox.min, 2) },
        { label: "Q1", value: formatTooltipValue(hoveredBox.q1, 2) },
        { label: "Median", value: formatTooltipValue(hoveredBox.median, 2) },
        { label: "Q3", value: formatTooltipValue(hoveredBox.q3, 2) },
        { label: "Max", value: formatTooltipValue(hoveredBox.max, 2) },
      ]
    : [];

  if (!boxes.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
      >
        No data
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div style={{ height }} className="relative">
        <svg
          viewBox={`0 0 ${widthViewBox} ${height}`}
          className="w-full"
          style={{ height }}
          role="img"
          aria-label="Box plot of power by category"
        >
          {/* horizontal grid lines */}
          {yTicks.map(({ v, y }) => (
            <line
              key={`grid-${v}`}
              x1={MARGIN.left}
              x2={MARGIN.left + innerWidth}
              y1={MARGIN.top + y}
              y2={MARGIN.top + y}
              stroke={gridStroke}
              strokeOpacity={gridOpacity}
              strokeWidth={1}
            />
          ))}

          {/* y axis */}
          {yTicks.map(({ v, y }) => (
            <g key={`ytick-${v}`}>
              <text
                x={MARGIN.left - 8}
                y={MARGIN.top + y + 4}
                textAnchor="end"
                fill={axisTextFill}
                fontSize={axisFont}
                fontFamily="Inter, sans-serif"
              >
                {v}
              </text>
            </g>
          ))}

          {/* x axis (categories) */}
          {xTicks.map(({ cat, x }) => (
            <g key={`xtick-${cat}`}>
              <text
                x={MARGIN.left + x}
                y={MARGIN.top + innerHeight + 20}
                textAnchor="middle"
                fill={axisTextFill}
                fontSize={axisFont}
                fontFamily="Inter, sans-serif"
              >
                {cat}
              </text>
            </g>
          ))}

          {/* axis titles */}
          {yLabel ? (
            <text
              x={14}
              y={MARGIN.top + innerHeight / 2}
              fill={axisTextFill}
              fontSize={axisFont}
              fontFamily="Inter, sans-serif"
              transform={`rotate(-90 14 ${MARGIN.top + innerHeight / 2})`}
              textAnchor="middle"
            >
              {yLabel}
            </text>
          ) : null}
          {xLabel ? (
            <text
              x={MARGIN.left + innerWidth / 2}
              y={MARGIN.top + innerHeight + 38}
              fill={axisTextFill}
              fontSize={axisFont}
              fontFamily="Inter, sans-serif"
              textAnchor="middle"
            >
              {xLabel}
            </text>
          ) : null}

          {/* box + whiskers per category */}
          {boxes.map((box) => {
            const bandX = xScale(box.category) ?? 0;
            const boxX = MARGIN.left + bandX;
            const boxW = xScale.bandwidth();
            const color = colors[box.category] ?? "#6366F1";
            const isHover = hovered === box.category;
            const y = (v: number) => MARGIN.top + yScale(v);

            return (
              <g
                key={box.category}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(box.category)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setHovered(box.category)}
              >
                {/* whiskers */}
                <line
                  x1={boxX + boxW / 2}
                  x2={boxX + boxW / 2}
                  y1={y(box.min)}
                  y2={y(box.max)}
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                <line
                  x1={boxX + boxW / 4}
                  x2={boxX + (boxW * 3) / 4}
                  y1={y(box.min)}
                  y2={y(box.min)}
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                <line
                  x1={boxX + boxW / 4}
                  x2={boxX + (boxW * 3) / 4}
                  y1={y(box.max)}
                  y2={y(box.max)}
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                {/* box */}
                <rect
                  x={boxX}
                  y={y(box.q3)}
                  width={boxW}
                  height={Math.max(1, y(box.q1) - y(box.q3))}
                  fill={color}
                  fillOpacity={isHover ? 0.55 : 0.4}
                  stroke={isDark ? "#E5E7EB" : "#1E293B"}
                  strokeWidth={1.5}
                  rx={2}
                />
                {/* median line */}
                <line
                  x1={boxX}
                  x2={boxX + boxW}
                  y1={y(box.median)}
                  y2={y(box.median)}
                  stroke={isDark ? "#F3F4F6" : "#111827"}
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>

        {/* hover tooltip (desktop only; mobile uses the readout below) */}
        {hoveredBox && !isNarrow ? (
          <ChartTooltipCard className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2">
            <TooltipHeader>{hoveredBox.category}</TooltipHeader>
            {readoutRows.map((r) => (
              <TooltipRow key={r.label} label={r.label} value={r.value} />
            ))}
          </ChartTooltipCard>
        ) : null}
      </div>

      {isNarrow ? (
        <ChartReadout header={hovered ?? undefined} rows={readoutRows} />
      ) : null}
    </div>
  );
}
