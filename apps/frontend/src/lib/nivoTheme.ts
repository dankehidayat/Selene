// apps/frontend/src/lib/nivoTheme.ts
// Shared Nivo theme factory — light/dark aware.

export const axisFont = {
  fontSize: 11,
  fontFamily: "Inter, sans-serif",
};

export function createNivoTheme(isDark: boolean) {
  return {
    background: "transparent",
    axis: {
      domain: { line: { stroke: isDark ? "#374151" : "#E5E7EB", strokeWidth: 0 } },
      ticks: {
        line: { stroke: isDark ? "#374151" : "#E5E7EB", strokeWidth: 0 },
        text: { fill: isDark ? "#9CA3AF" : "#9CA3AF", ...axisFont },
      },
    },
    grid: {
      line: {
        stroke: isDark ? "#374151" : "#E5E7EB",
        strokeOpacity: 0.35,
      },
    },
    legends: {
      text: { fill: isDark ? "#D1D5DB" : "#6B7280", ...axisFont },
    },
    tooltip: {
      container: {
        background: isDark ? "#1F2937" : "#ffffff",
        color: isDark ? "#E5E7EB" : "#1F2937",
        fontSize: "12px",
        borderRadius: "12px",
        border: isDark ? "1px solid #374151" : "1px solid #E5E7EB",
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        padding: "10px 14px",
        fontFamily: "Inter, sans-serif",
      },
    },
    crosshair: {
      line: { stroke: isDark ? "#6B7280" : "#9CA3AF", strokeWidth: 1, strokeDasharray: "4 4" },
    },
    dots: {
      text: { fill: isDark ? "#9CA3AF" : "#6B7280", fontSize: 11 },
    },
    markers: {
      lineColor: isDark ? "#6B7280" : "#9CA3AF",
      lineStrokeWidth: 1,
      text: { fill: isDark ? "#9CA3AF" : "#9CA3AF", fontSize: 10, fontFamily: "Inter, sans-serif" },
    },
  } as Record<string, any>;
}