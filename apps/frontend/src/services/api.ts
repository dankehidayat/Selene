// [apps/frontend] src/services/api.ts
import { useQuery } from "@tanstack/react-query";
import type { EnergyReading } from "@/types/energy";

const BLYNK_SERVER =
  import.meta.env.VITE_BLYNK_SERVER_URL ?? "http://iot.serangkota.go.id:8080";
const AUTH_TOKEN = import.meta.env.VITE_BLYNK_AUTH_TOKEN ?? "";
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";

export interface AnalyticsSummary {
  range: string;
  dataPoints: number;
  bucketSize: string;
  timeSpan: { from: string; to: string };
  power: {
    average: number;
    median: number;
    stdDeviation: number;
    min: number;
    max: number;
  };
  voltage: { average: number };
  powerFactor: { average: number };
  reactivePower: { average: number; ratio: number };
  energy: { totalKwh: number; estimatedCost: string };
  peakHours: Array<{ hour: number; avgPower: number }>;
}

export interface ClimateSummary {
  range: string;
  dataPoints: number;
  bucketSize: string;
  temperature: {
    average: number;
    median: number;
    stdDeviation: number;
    min: number;
    max: number;
    degreeHours: number;
  };
  humidity: {
    average: number;
    median: number;
    stdDeviation: number;
    min: number;
    max: number;
  };
  dewPoint: { average: number };
  correlation: { tempHumidity: number };
  comfortDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  hourlyData: Array<{ hour: number; temperature: number; humidity: number }>;
}

async function fetchPin(pin: number): Promise<number> {
  const url = `${BLYNK_SERVER}/${AUTH_TOKEN}/get/v${pin}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch v${pin}: ${res.status}`);
  const data = await res.json();
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchLiveReading(): Promise<EnergyReading> {
  const [
    acVoltage,
    acCurrent,
    acPower,
    cosPhi,
    apparentPower,
    totalEnergy,
    frequency,
    reactivePower,
    temperature,
    humidity,
    tempComfortRaw,
    energyStatusRaw,
  ] = await Promise.all([
    fetchPin(0),
    fetchPin(1),
    fetchPin(2),
    fetchPin(3),
    fetchPin(4),
    fetchPin(5),
    fetchPin(6),
    fetchPin(7),
    fetchPin(8),
    fetchPin(9),
    fetchPin(10),
    fetchPin(11),
  ]);
  let energyStatus: "1" | "2" | "3" = "2";
  if (energyStatusRaw === 1) energyStatus = "1";
  else if (energyStatusRaw === 2) energyStatus = "2";
  else if (energyStatusRaw === 3) energyStatus = "3";
  const comfortMap: Record<string, EnergyReading["tempComfort"]> = {
    COLD: "COLD",
    COOL: "COOL",
    COMFORTABLE: "COMFORTABLE",
    WARM: "WARM",
    HOT: "HOT",
  };
  const tempComfort =
    comfortMap[String(tempComfortRaw)?.toUpperCase()] ?? "COMFORTABLE";
  const voltage = Number(acVoltage);
  const power = Number(acPower);
  const powerQuality = Math.max(
    0,
    Math.min(
      100,
      100 - Math.abs(power - 400) / 6 + Math.abs(voltage - 220) / 6,
    ),
  );
  const stability = Math.max(
    0.5,
    Math.min(1, 1 - Math.abs(voltage - 220) / 220),
  );
  return {
    timestamp: new Date().toISOString(),
    acVoltage: voltage,
    acCurrent: Number(acCurrent),
    acPower: power,
    cosPhi: Number(cosPhi),
    apparentPower: Number(apparentPower),
    totalEnergy: Number(totalEnergy),
    frequency: Number(frequency),
    reactivePower: Number(reactivePower),
    temperature: Number(temperature),
    humidity: Number(humidity),
    tempComfort,
    energyStatus,
    powerQualityScore: Number(powerQuality.toFixed(2)),
    voltageStability: Number(stability.toFixed(3)),
  };
}

async function fetchHistory(range: string) {
  const res = await fetch(`${API_BASE}/readings/history?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

async function fetchRecentReadings(limit: number) {
  const res = await fetch(`${API_BASE}/readings/logs?pageSize=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

async function fetchAnalyticsSummary(range: string): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/analytics/summary?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

async function fetchClimateSummary(range: string): Promise<ClimateSummary> {
  const res = await fetch(`${API_BASE}/analytics/climate?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch climate analytics");
  return res.json();
}

export function useLiveReading() {
  return useQuery<EnergyReading>({
    queryKey: ["live-reading"],
    queryFn: fetchLiveReading,
    refetchInterval: 3000,
    staleTime: 0,
    enabled: !!AUTH_TOKEN,
  });
}

export function useReadingHistory(
  range: "1h" | "24h" | "7d" | "30d" | "3m" | "6m" | "1y",
) {
  return useQuery<
    Array<{
      timestamp: string;
      voltage: number;
      power: number;
      temperature: number;
      humidity: number;
    }>
  >({
    queryKey: ["reading-history", range],
    queryFn: () => fetchHistory(range),
    refetchInterval: 30_000,
  });
}

export function useRecentReadings(limit = 20) {
  return useQuery<EnergyReading[]>({
    queryKey: ["recent-readings", limit],
    queryFn: () => fetchRecentReadings(limit),
    refetchInterval: 10_000,
  });
}

export function useAnalyticsSummary(
  range: "1h" | "24h" | "7d" | "30d" | "3m" | "6m" | "1y",
) {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics-summary", range],
    queryFn: () => fetchAnalyticsSummary(range),
    refetchInterval: 30_000,
  });
}

export function useClimateSummary(
  range: "1h" | "24h" | "7d" | "30d" | "3m" | "6m" | "1y",
) {
  return useQuery<ClimateSummary>({
    queryKey: ["climate-summary", range],
    queryFn: () => fetchClimateSummary(range),
    refetchInterval: 30_000,
  });
}

export interface FuzzyDistribution {
  distribution: { ECONOMICAL: number; NORMAL: number; WASTEFUL: number };
  total: number;
  scatterData: Array<{ power: number; powerFactor: number; category: string }>;
  boxData: Array<{
    category: string;
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    count: number;
  } | null>;
  results: Array<{
    timestamp: string;
    voltage: number;
    power: number;
    powerFactor: number;
    reactivePower: number;
    category: string;
    confidence: number;
    strengths: { economical: number; normal: number; wasteful: number };
  }>;
}

export interface MembershipData {
  voltageMembership: Array<{
    x: number;
    low: number;
    normal: number;
    high: number;
  }>;
  powerMembership: Array<{
    x: number;
    economical: number;
    normal: number;
    wasteful: number;
  }>;
  pfMembership: Array<{ x: number; poor: number; fair: number; good: number }>;
  reactiveMembership: Array<{
    x: number;
    low: number;
    medium: number;
    high: number;
  }>;
}

async function fetchFuzzyDistribution(
  range: string,
): Promise<FuzzyDistribution> {
  const res = await fetch(
    `${API_BASE}/analytics/fuzzy-distribution?range=${range}`,
  );
  if (!res.ok) throw new Error("Failed to fetch fuzzy distribution");
  return res.json();
}

async function fetchMembershipData(): Promise<MembershipData> {
  const res = await fetch(`${API_BASE}/analytics/membership`);
  if (!res.ok) throw new Error("Failed to fetch membership data");
  return res.json();
}

export function useFuzzyDistribution(range: string) {
  return useQuery<FuzzyDistribution>({
    queryKey: ["fuzzy-distribution", range],
    queryFn: () => fetchFuzzyDistribution(range),
    refetchInterval: 60_000,
  });
}

export function useMembershipData() {
  return useQuery<MembershipData>({
    queryKey: ["membership-data"],
    queryFn: fetchMembershipData,
    staleTime: 5 * 60_000,
  });
}

export interface DecisionSurfacePoint {
  power: number;
  pf: number;
  category: string;
}

export interface BoxPlotData {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export interface BlandAltmanResult {
  data: Array<{ mean: number; difference: number }>;
  meanDiff: number;
  upperLoA: number;
  lowerLoA: number;
}

async function fetchDecisionSurface(): Promise<DecisionSurfacePoint[]> {
  const res = await fetch(`${API_BASE}/analytics/decision-surface`);
  if (!res.ok) throw new Error("Failed to fetch decision surface");
  return res.json();
}

async function fetchBoxPlot(range: string): Promise<BoxPlotData[]> {
  const res = await fetch(`${API_BASE}/analytics/box-plot?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch box plot data");
  return res.json();
}

async function fetchBlandAltman(range: string): Promise<BlandAltmanResult> {
  const res = await fetch(`${API_BASE}/analytics/bland-altman?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch Bland-Altman data");
  return res.json();
}

export function useDecisionSurface() {
  return useQuery<DecisionSurfacePoint[]>({
    queryKey: ["decision-surface"],
    queryFn: fetchDecisionSurface,
    staleTime: 5 * 60_000,
  });
}

export function useBoxPlot(range: string) {
  return useQuery<BoxPlotData[]>({
    queryKey: ["box-plot", range],
    queryFn: () => fetchBoxPlot(range),
    refetchInterval: 60_000,
  });
}

export function useBlandAltman(range: string) {
  return useQuery<BlandAltmanResult>({
    queryKey: ["bland-altman", range],
    queryFn: () => fetchBlandAltman(range),
    refetchInterval: 60_000,
  });
}
