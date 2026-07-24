// apps/frontend/src/services/api.ts
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { EnergyReading } from "@/types/energy";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// ── SSE Live Data (replaces Blynk polling) ────────────────
export function useLiveReading() {
  const [data, setData] = useState<EnergyReading | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/readings/stream`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setData({
          timestamp: new Date().toISOString(),
          acVoltage: parsed.acVoltage,
          acCurrent: parsed.acCurrent,
          acPower: parsed.acPower,
          cosPhi: parsed.cosPhi,
          apparentPower: parsed.apparentPower,
          totalEnergy: parsed.totalEnergy,
          frequency: parsed.frequency,
          reactivePower: parsed.reactivePower,
          temperature: parsed.temperature,
          humidity: parsed.humidity,
          tempComfort: parsed.tempComfort ?? "COMFORTABLE",
          energyStatus: parsed.energyStatus ?? "2",
          powerQualityScore: parsed.powerQualityScore ?? undefined,
          voltageStability: parsed.voltageStability ?? undefined,
        });
      } catch {
        // Ignore malformed SSE data
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects, no action needed
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return { data, isLoading: false };
}

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

export interface FuzzyDistribution {
  distribution: { ECONOMICAL: number; NORMAL: number; WASTEFUL: number };
  total: number;
  scatterData: Array<{ power: number; powerFactor: number; category: string }>;
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
  if (!res.ok) throw new Error("Failed to fetch climate");
  return res.json();
}

async function fetchFuzzyDistribution(
  range: string,
): Promise<FuzzyDistribution> {
  const res = await fetch(
    `${API_BASE}/analytics/fuzzy-distribution?range=${range}`,
  );
  if (!res.ok) throw new Error("Failed to fetch fuzzy");
  return res.json();
}

async function fetchMembershipData(): Promise<MembershipData> {
  const res = await fetch(`${API_BASE}/analytics/membership`);
  if (!res.ok) throw new Error("Failed to fetch membership");
  return res.json();
}

async function fetchDecisionSurface(): Promise<DecisionSurfacePoint[]> {
  const res = await fetch(`${API_BASE}/analytics/decision-surface`);
  if (!res.ok) throw new Error("Failed to fetch decision surface");
  return res.json();
}

async function fetchBoxPlot(range: string): Promise<BoxPlotData[]> {
  const res = await fetch(`${API_BASE}/analytics/box-plot?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch box plot");
  return res.json();
}

async function fetchBlandAltman(range: string): Promise<BlandAltmanResult> {
  const res = await fetch(`${API_BASE}/analytics/bland-altman?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch Bland-Altman");
  return res.json();
}

async function fetchEnergyHistory(range: string) {
  const res = await fetch(
    `${API_BASE}/readings/history?range=${range}&type=energy`,
  );
  if (!res.ok) throw new Error("Failed to fetch energy history");
  return res.json();
}

export function useReadingHistory(
  range: "1h" | "24h" | "7d" | "30d" | "3m" | "6m" | "1y",
) {
  return useQuery<
    Array<{
      timestamp: string;
      voltage: number;
      power: number;
      current: number;
      temperature: number;
      humidity: number;
    }>
  >({
    queryKey: ["reading-history", range],
    queryFn: () => fetchHistory(range),
    refetchInterval: 30_000,
  });
}

export function useEnergyHistory(
  range: "1h" | "24h" | "7d" | "30d" | "3m" | "6m" | "1y",
) {
  return useQuery<Array<{ timestamp: string; energy_kwh: number }>>({
    queryKey: ["energy-history", range],
    queryFn: () => fetchEnergyHistory(range),
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

export interface ClimateFuzzyDistribution {
  distribution: {
    COLD: number;
    COOL: number;
    COMFORTABLE: number;
    WARM: number;
    HOT: number;
  };
  total: number;
  scatterData: Array<{
    temperature: number;
    humidity: number;
    category: string;
  }>;
  results: Array<{
    timestamp: string;
    temperature: number;
    humidity: number;
    category: string;
    confidence: number;
  }>;
}

async function fetchClimateFuzzyDistribution(
  range: string,
): Promise<ClimateFuzzyDistribution> {
  const res = await fetch(
    `${API_BASE}/analytics/climate-fuzzy-distribution?range=${range}`,
  );
  if (!res.ok) throw new Error("Failed to fetch climate fuzzy distribution");
  return res.json();
}

export function useClimateFuzzyDistribution(range: string) {
  return useQuery<ClimateFuzzyDistribution>({
    queryKey: ["climate-fuzzy-distribution", range],
    queryFn: () => fetchClimateFuzzyDistribution(range),
    refetchInterval: 60_000,
  });
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { loginHistory: number };
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalLogins: number;
}

async function fetchAdminUsers(params?: {
  search?: string;
  role?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const token = localStorage.getItem("token");
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.role) searchParams.set("role", params.role);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE}/admin/users?${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function fetchAdminStats(): Promise<AdminStats> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function updateUserRole(userId: string, role: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update role");
}

async function toggleUserActive(userId: string): Promise<void> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-active`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to toggle user status");
}

export function useAdminUsers(params?: {
  search?: string;
  role?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => fetchAdminUsers(params),
    enabled: !!localStorage.getItem("token"),
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    enabled: !!localStorage.getItem("token"),
    refetchInterval: 30_000,
  });
}

export { updateUserRole, toggleUserActive };
