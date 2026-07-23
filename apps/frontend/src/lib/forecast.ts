// apps/frontend/src/lib/forecast.ts
// Adaptive ML forecasting: Linear Regression + Exponential Smoothing + Pattern Matching
// Dynamically adjusts horizon based on data density and selected range

interface DataPoint {
  timestamp: string;
  value: number;
}

export interface ForecastPoint {
  timestamp: string;
  value: number;
  isForecast: boolean;
}

class LinearRegression {
  m: number = 0;
  b: number = 0;
  learningRate: number;
  epochs: number;

  constructor(learningRate: number = 0.0001, epochs: number = 200) {
    this.learningRate = learningRate;
    this.epochs = epochs;
  }

  fit(xValues: number[], yValues: number[]): void {
    if (xValues.length < 2) return;
    const n = xValues.length;
    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const xStd =
      Math.sqrt(xValues.reduce((a, b) => a + (b - xMean) ** 2, 0) / n) || 1;
    const xNorm = xValues.map((x) => (x - xMean) / xStd);
    this.m = 0;
    this.b = yValues.reduce((a, b) => a + b, 0) / n;
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      let mG = 0,
        bG = 0;
      for (let i = 0; i < n; i++) {
        const pred = this.m * xNorm[i] + this.b;
        const err = pred - yValues[i];
        mG += err * xNorm[i];
        bG += err;
      }
      this.m -= (this.learningRate * mG) / n;
      this.b -= (this.learningRate * bG) / n;
    }
    this.m = this.m / xStd;
    this.b = this.b - this.m * xMean;
  }

  predict(x: number): number {
    return this.m * x + this.b;
  }
}

function emaWithTrend(
  data: number[],
  alpha: number = 0.3,
): { smoothed: number; trend: number } {
  if (data.length < 2) return { smoothed: data[0] || 0, trend: 0 };
  let smoothed = data[0];
  for (let i = 1; i < data.length; i++)
    smoothed = alpha * data[i] + (1 - alpha) * smoothed;
  const recentCount = Math.max(2, Math.floor(data.length * 0.2));
  const recent = data.slice(-recentCount);
  const trend = (recent[recent.length - 1] - recent[0]) / recentCount;
  return { smoothed, trend };
}

function extractHourlyPattern(
  data: DataPoint[],
): Map<number, { avg: number; std: number; count: number }> {
  const hourly: Map<number, number[]> = new Map();
  for (const p of data) {
    const h = new Date(p.timestamp).getHours();
    if (!hourly.has(h)) hourly.set(h, []);
    hourly.get(h)!.push(p.value);
  }
  const pattern = new Map<
    number,
    { avg: number; std: number; count: number }
  >();
  for (const [h, vals] of hourly) {
    const n = vals.length;
    const avg = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
    pattern.set(h, {
      avg: Number(avg.toFixed(3)),
      std: Number(Math.sqrt(variance).toFixed(3)),
      count: n,
    });
  }
  return pattern;
}

function getForecastHorizon(range: string): {
  points: number;
  intervalMinutes: number;
} {
  switch (range) {
    case "1h":
      return { points: 12, intervalMinutes: 5 };
    case "24h":
      return { points: 24, intervalMinutes: 60 };
    case "7d":
      return { points: 48, intervalMinutes: 60 };
    case "30d":
      return { points: 30, intervalMinutes: 1440 };
    case "3m":
      return { points: 12, intervalMinutes: 10080 };
    case "6m":
      return { points: 12, intervalMinutes: 43200 };
    case "1y":
      return { points: 12, intervalMinutes: 43200 };
    default:
      return { points: 24, intervalMinutes: 60 };
  }
}

export function linearRegressionForecast(
  data: DataPoint[],
  range: string = "24h",
): ForecastPoint[] {
  if (data.length < 3) return [];
  const { points, intervalMinutes } = getForecastHorizon(range);
  const trainingSize = Math.min(data.length, Math.max(3, points * 3));
  const training = data.slice(-trainingSize);
  const xVals = training.map((_, i) => i);
  const yVals = training.map((d) => d.value);
  const model = new LinearRegression(0.0001, data.length < 10 ? 500 : 300);
  model.fit(xVals, yVals);
  const lastTs = new Date(data[data.length - 1].timestamp);
  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= points; i++) {
    forecast.push({
      timestamp: new Date(
        lastTs.getTime() + i * intervalMinutes * 60000,
      ).toISOString(),
      value: Math.max(0, Number(model.predict(xVals.length + i).toFixed(2))),
      isForecast: true,
    });
  }
  return forecast;
}

export function patternForecast(
  data: DataPoint[],
  range: string = "24h",
): ForecastPoint[] {
  if (data.length < 2) return [];
  const { points, intervalMinutes } = getForecastHorizon(range);
  const pattern = extractHourlyPattern(data);
  const ema = emaWithTrend(data.slice(-200).map((d) => d.value));
  const lastTs = new Date(data[data.length - 1].timestamp);
  const forecast: ForecastPoint[] = [];

  for (let i = 1; i <= points; i++) {
    const ft = new Date(lastTs.getTime() + i * intervalMinutes * 60000);
    const h = ft.getHours();
    const stats = pattern.get(h);
    const pv = stats?.avg ?? ema.smoothed;
    const trendAdj = ema.trend * Math.min(i, Math.ceil(points / 4));
    forecast.push({
      timestamp: ft.toISOString(),
      value: Math.max(0, Number((pv + trendAdj).toFixed(2))),
      isForecast: true,
    });
  }
  return forecast;
}

export function ensembleForecast(
  data: DataPoint[],
  range: string = "24h",
): { forecast: ForecastPoint[]; confidence: number } {
  if (data.length < 3) return { forecast: [], confidence: 0 };
  const { points } = getForecastHorizon(range);
  const lr = linearRegressionForecast(data, range);
  const pat = patternForecast(data, range);
  if (!lr.length || !pat.length)
    return { forecast: lr.length ? lr : pat, confidence: 0.5 };
  const lrW = Math.max(0.1, Math.min(0.7, 1 - points / 200));
  const patW = 1 - lrW;
  const forecast = lr.map((l, i) => ({
    timestamp: l.timestamp,
    value: Number(
      (l.value * lrW + (pat[i]?.value ?? l.value) * patW).toFixed(2),
    ),
    isForecast: true,
  }));
  const dataScore = Math.min(1, data.length / 500);
  const horizonPenalty = Math.max(0.3, 1 - points / 200);
  return {
    forecast,
    confidence: Number((dataScore * horizonPenalty).toFixed(2)),
  };
}

export function confidenceBands(
  forecast: ForecastPoint[],
  pct: number = 15,
): { upper: ForecastPoint[]; lower: ForecastPoint[] } {
  return {
    upper: forecast.map((f) => ({
      ...f,
      value: Number((f.value * (1 + pct / 100)).toFixed(2)),
    })),
    lower: forecast.map((f) => ({
      ...f,
      value: Number(Math.max(0, f.value * (1 - pct / 100)).toFixed(2)),
    })),
  };
}
