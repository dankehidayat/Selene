// Largest-Triangle-Three-Buckets — shape-preserving downsample for time series.

export type XY = { x: number; y: number; raw: unknown };

/**
 * Downsample to at most `threshold` points while preserving visual extrema.
 * Input must be sorted by x ascending.
 */
export function lttb<T>(
  data: T[],
  threshold: number,
  getX: (d: T) => number,
  getY: (d: T) => number,
): T[] {
  const n = data.length;
  if (threshold >= n || threshold < 3 || n < 3) return data;

  const sampled: T[] = [];
  sampled.push(data[0]);

  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);

    // Average of next bucket (for triangle area)
    const avgRangeStart = Math.floor((i + 2) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, n);
    let avgX = 0;
    let avgY = 0;
    const avgRangeLength = Math.max(1, avgRangeEnd - avgRangeStart);
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += getX(data[j]);
      avgY += getY(data[j]);
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    const pointAX = getX(data[a]);
    const pointAY = getY(data[a]);

    let maxArea = -1;
    let nextA = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const area =
        Math.abs(
          (pointAX - avgX) * (getY(data[j]) - pointAY) -
            (pointAX - getX(data[j])) * (avgY - pointAY),
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled.push(data[nextA]);
    a = nextA;
  }

  sampled.push(data[n - 1]);
  return sampled;
}

/** Light EMA smooth — preserves level, softens sensor noise after LTTB. */
export function emaSmooth(
  values: number[],
  alpha: number,
): number[] {
  if (values.length === 0 || alpha <= 0) return values;
  const a = Math.min(1, Math.max(0.01, alpha));
  const out = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = a * values[i] + (1 - a) * out[i - 1];
  }
  return out;
}
