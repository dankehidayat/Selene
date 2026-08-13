// apps/frontend/src/components/charts/NivoBarChart.tsx
import { useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { useChartAnimation } from "@/hooks/useChartAnimation";
import { useChartWidth } from "@/hooks/useChartWidth";
import { ChartTooltipCard, formatTooltipValue } from "./ChartTooltip";

interface NivoBarChartProps {
  data: Record<string, any>[];
  indexBy: string;
  keys: string[];
  colors?: string[];
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  axisBottomFormat?: (v: string) => string;
  axisLeftFormat?: (v: number) => string;
  labelFormat?: (v: number) => string;
  /** Border radius for bar tops (px). */
  radius?: number;
  tooltip?: (datum: any) => React.ReactNode;
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 50 };
const NARROW_MARGIN = { top: 8, right: 8, bottom: 26, left: 40 };
const NARROW_BREAKPOINT = 480;

export function NivoBarChart({
  data,
  indexBy,
  keys,
  colors = ["#3B82F6"],
  height = 300,
  margin,
  axisBottomFormat,
  axisLeftFormat,
  radius = 6,
  tooltip,
}: NivoBarChartProps) {
  const isDark = useIsDarkMode();
  const animate = useChartAnimation();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);

  // Responsive: tighter left margin + thin the category labels on narrow phones
  // so many categories (e.g. 24 hours) don't collide.
  const [containerRef, width] = useChartWidth<HTMLDivElement>();
  const isNarrow = width > 0 && width < NARROW_BREAKPOINT;
  const resolvedMargin = margin ?? (isNarrow ? NARROW_MARGIN : MARGIN);

  const bottomTickValues = useMemo(() => {
    const categories = data.map((d) => d[indexBy]);
    if (!isNarrow || categories.length <= 8) return undefined;
    const step = Math.ceil(categories.length / 6);
    return categories.filter((_, i) => i % step === 0);
  }, [data, indexBy, isNarrow]);

  return (
    <div style={{ height }} ref={containerRef}>
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy={indexBy}
        theme={theme}
        margin={resolvedMargin}
        padding={0.3}
        valueScale={{ type: "linear" }}
        indexScale={{ type: "band", round: true }}
        colors={colors}
        borderColor={{ from: "color", modifiers: [["darker", 1.6]] }}
        borderRadius={radius}
        borderWidth={0}
        enableGridY
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          format: axisBottomFormat,
          tickValues: bottomTickValues,
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          format: axisLeftFormat,
        }}
        enableLabel={false}
        isInteractive
        animate={animate}
        tooltip={
          tooltip
            ? (tooltip as any)
            : ({ id, value }: any) => (
                <ChartTooltipCard>
                  <p className="text-gray-400 dark:text-gray-400">
                    {id}:{" "}
                    <span className="text-gray-900 dark:text-white font-semibold tabular-nums">
                      {formatTooltipValue(Number(value))}
                    </span>
                  </p>
                </ChartTooltipCard>
              )
        }
        role="application"
      />
    </div>
  );
}