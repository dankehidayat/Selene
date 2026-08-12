// apps/frontend/src/components/charts/NivoBarChart.tsx
import { useMemo } from "react";
import { ResponsiveBar } from "@nivo/bar";
import { createNivoTheme } from "@/lib/nivoTheme";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

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

export function NivoBarChart({
  data,
  indexBy,
  keys,
  colors = ["#3B82F6"],
  height = 300,
  margin = MARGIN,
  axisBottomFormat,
  axisLeftFormat,
  radius = 6,
  tooltip,
}: NivoBarChartProps) {
  const isDark = useIsDarkMode();
  const theme = useMemo(() => createNivoTheme(isDark), [isDark]);

  return (
    <div style={{ height }}>
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy={indexBy}
        theme={theme}
        margin={margin}
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
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          format: axisLeftFormat,
        }}
        enableLabel={false}
        isInteractive
        tooltip={tooltip ? (tooltip as any) : undefined}
        role="application"
      />
    </div>
  );
}