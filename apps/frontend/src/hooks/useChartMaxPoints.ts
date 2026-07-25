import { useEffect, useState } from "react";
import {
  estimateChartWidth,
  maxPointsForWidth,
} from "@/lib/chartPoints";

/**
 * Live maxPoints for history APIs: ~2× chart CSS pixels, updates on resize.
 */
export function useChartMaxPoints(): number {
  const [maxPoints, setMaxPoints] = useState(() =>
    maxPointsForWidth(estimateChartWidth()),
  );

  useEffect(() => {
    const update = () =>
      setMaxPoints(maxPointsForWidth(estimateChartWidth()));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return maxPoints;
}
