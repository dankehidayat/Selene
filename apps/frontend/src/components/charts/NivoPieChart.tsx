// apps/frontend/src/components/charts/NivoPieChart.tsx
import { useMemo, useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { useChartAnimation } from "@/hooks/useChartAnimation";
import { useChartWidth } from "@/hooks/useChartWidth";
import { ChartTooltipCard, formatTooltipValue, TooltipRow } from "./ChartTooltip";
import { ChartReadout } from "./ChartReadout";

interface NivoPieDatum {
  id: string;
  value: number;
  color: string;
}

interface NivoPieChartProps {
  data: NivoPieDatum[];
  height?: number;
  innerRadius?: number;
  tooltip?: (datum: any) => React.ReactNode;
}

const NARROW_BREAKPOINT = 480;

export function NivoPieChart({
  data,
  height = 280,
  innerRadius = 0.6,
  tooltip,
}: NivoPieChartProps) {
  const isDark = useIsDarkMode();
  const animate = useChartAnimation();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);

  // Responsive: on narrow screens the side legend squeezes the pie, so drop it
  // for tight symmetric margins and render an HTML legend below instead.
  const [containerRef, width] = useChartWidth<HTMLDivElement>();
  const isNarrow = width > 0 && width < NARROW_BREAKPOINT;

  const total = data.reduce((s, d) => s + d.value, 0);
  const [active, setActive] = useState<{ id: string; value: number; color: string } | null>(null);

  const sideLegend = isNarrow
    ? []
    : [
        {
          anchor: "right" as const,
          direction: "column" as const,
          justify: false,
          translateX: 0,
          translateY: 0,
          itemsSpacing: 6,
          itemWidth: 100,
          itemHeight: 18,
          itemTextColor: isDark ? "#D1D5DB" : "#6B7280",
          itemDirection: "left-to-right" as const,
          itemOpacity: 1,
          symbolSize: 12,
          symbolShape: "circle" as const,
          effects: [
            {
              on: "hover" as const,
              style: { itemTextColor: isDark ? "#ffffff" : "#1F2937" },
            },
          ],
        },
      ];

  return (
    <div ref={containerRef}>
      <div style={{ height }}>
        <ResponsivePie
          data={data}
          theme={theme}
          margin={
            isNarrow
              ? { top: 8, right: 8, bottom: 8, left: 8 }
              : { top: 8, right: 80, bottom: 8, left: 80 }
          }
          innerRadius={innerRadius}
          padAngle={2}
          cornerRadius={4}
          activeOuterRadiusOffset={6}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
          colors={{ datum: "data.color" }}
          enableArcLinkLabels={false}
          enableArcLabels={false}
          isInteractive
          animate={animate}
          tooltip={
            isNarrow
              ? () => null
              : tooltip ??
                (({ datum }: any) => {
                  const pct = total > 0 ? ((datum.value / total) * 100).toFixed(1) : "0";
                  return (
                    <ChartTooltipCard>
                      <TooltipRow
                        label={datum.id}
                        value={`${formatTooltipValue(datum.value)} (${pct}%)`}
                        color={datum.color}
                      />
                    </ChartTooltipCard>
                  );
                })
          }
          legends={sideLegend}
          onClick={(datum: any) => {
            if (!isNarrow) return;
            setActive({ id: String(datum.id), value: datum.value, color: datum.color });
          }}
        />
      </div>
      {isNarrow && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {data.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              {d.id}
            </span>
          ))}
        </div>
      )}
      {isNarrow ? (
        <ChartReadout
          rows={
            active
              ? [
                  {
                    label: active.id,
                    value: `${formatTooltipValue(active.value)} (${total > 0 ? ((active.value / total) * 100).toFixed(1) : "0"}%)`,
                    color: active.color,
                  },
                ]
              : []
          }
        />
      ) : null}
    </div>
  );
}
