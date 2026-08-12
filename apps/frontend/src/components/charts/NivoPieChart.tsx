// apps/frontend/src/components/charts/NivoPieChart.tsx
import { useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

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

export function NivoPieChart({
  data,
  height = 280,
  innerRadius = 0.6,
  tooltip,
}: NivoPieChartProps) {
  const isDark = useIsDarkMode();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ height }}>
      <ResponsivePie
        data={data}
        theme={theme}
        margin={{ top: 8, right: 80, bottom: 8, left: 80 }}
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
        tooltip={({ datum }) => {
          const pct = total > 0 ? ((datum.value / total) * 100).toFixed(1) : "0";
          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg px-3.5 py-2.5 text-xs font-sans">
              <p className="text-gray-400 dark:text-gray-400">
                {datum.id}:{" "}
                <span className="text-gray-900 dark:text-white font-semibold">
                  {datum.value} ({pct}%)
                </span>
              </p>
            </div>
          );
        }}
        legends={[
          {
            anchor: "right",
            direction: "column",
            justify: false,
            translateX: 0,
            translateY: 0,
            itemsSpacing: 6,
            itemWidth: 100,
            itemHeight: 18,
            itemTextColor: isDark ? "#D1D5DB" : "#6B7280",
            itemDirection: "left-to-right",
            itemOpacity: 1,
            symbolSize: 12,
            symbolShape: "circle",
            effects: [
              {
                on: "hover",
                style: { itemTextColor: isDark ? "#ffffff" : "#1F2937" },
              },
            ],
          },
        ]}
        animate
        motionConfig="gentle"
      />
    </div>
  );
}