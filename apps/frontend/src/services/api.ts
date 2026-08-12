// apps/frontend/src/services/api.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { EnergyReading } from "@/types/energy";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export interface TimeRangeQuery {
  range?: string;
  from?: string;
  to?: string;
}

function buildTimeRangeParams(query: TimeRangeQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.range) p.set("range", query.range);
  if (query.from) p.set("from", query.from);
  if (query.to) p.set("to", query.to);
  return p;
}

// ── SSE Live Data ─────────────────────────────────────────
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
      // EventSource auto-reconnects
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
  bucketSize?: string;
  source?: "cagg" | "series";
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
  bucketSize?: string;
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
  /** Sampled points for box plots (Plot.boxX) — not full history */
  boxSamples: Array<{ power: number; category: string }>;
  boxPlot?: BoxPlotData[];
  blandAltman?: BlandAltmanResult;
  /** @deprecated use boxSamples / blandAltman */
  results?: Array<{
    timestamp?: string;
    power: number;
    category: string;
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

async function fetchHistory(query: TimeRangeQuery, maxPoints?: number) {
  const qs = buildTimeRangeParams(query);
  if (maxPoints != null) qs.set("maxPoints", String(maxPoints));
  const res = await fetch(`${API_BASE}/readings/history?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

async function fetchRecentReadings(limit: number) {
  const res = await fetch(`${API_BASE}/readings/logs?pageSize=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

async function fetchAnalyticsSummary(query: TimeRangeQuery): Promise<AnalyticsSummary> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(`${API_BASE}/analytics/summary?${params}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

async function fetchClimateSummary(query: TimeRangeQuery): Promise<ClimateSummary> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(`${API_BASE}/analytics/climate?${params}`);
  if (!res.ok) throw new Error("Failed to fetch climate");
  return res.json();
}

async function fetchFuzzyDistribution(
  query: TimeRangeQuery,
): Promise<FuzzyDistribution> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(`${API_BASE}/analytics/fuzzy-distribution?${params}`);
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

async function fetchBoxPlot(query: TimeRangeQuery): Promise<BoxPlotData[]> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(`${API_BASE}/analytics/box-plot?${params}`);
  if (!res.ok) throw new Error("Failed to fetch box plot");
  return res.json();
}

async function fetchBlandAltman(query: TimeRangeQuery): Promise<BlandAltmanResult> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(`${API_BASE}/analytics/bland-altman?${params}`);
  if (!res.ok) throw new Error("Failed to fetch Bland-Altman");
  return res.json();
}

async function fetchEnergyHistory(query: TimeRangeQuery, maxPoints?: number) {
  const qs = buildTimeRangeParams(query);
  qs.set("type", "energy");
  if (maxPoints != null) qs.set("maxPoints", String(maxPoints));
  const res = await fetch(`${API_BASE}/readings/history?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch energy history");
  return res.json();
}

export function useReadingHistory(
  query: TimeRangeQuery,
  enabled = true,
  maxPoints?: number,
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
    queryKey: ["reading-history", query, maxPoints ?? "auto"],
    queryFn: () => fetchHistory(query, maxPoints),
    refetchInterval: 30_000,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useEnergyHistory(
  query: TimeRangeQuery,
  enabled = true,
  maxPoints?: number,
) {
  return useQuery<Array<{ timestamp: string; energy_kwh: number }>>({
    queryKey: ["energy-history", query, maxPoints ?? "auto"],
    queryFn: () => fetchEnergyHistory(query, maxPoints),
    refetchInterval: 30_000,
    enabled,
    placeholderData: keepPreviousData,
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
  query: TimeRangeQuery,
  enabled = true,
) {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics-summary", query],
    queryFn: () => fetchAnalyticsSummary(query),
    refetchInterval: 30_000,
    enabled,
    placeholderData: keepPreviousData,
    // Summary is stage-1: prefer it over charts when both fire
    staleTime: 15_000,
  });
}

export function useClimateSummary(
  query: TimeRangeQuery,
  enabled = true,
) {
  return useQuery<ClimateSummary>({
    queryKey: ["climate-summary", query],
    queryFn: () => fetchClimateSummary(query),
    refetchInterval: 30_000,
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useFuzzyDistribution(query: TimeRangeQuery, enabled = true) {
  return useQuery<FuzzyDistribution>({
    queryKey: ["fuzzy-distribution", query],
    queryFn: () => fetchFuzzyDistribution(query),
    refetchInterval: 60_000,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMembershipData(enabled = true) {
  return useQuery<MembershipData>({
    queryKey: ["membership-data"],
    queryFn: fetchMembershipData,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useDecisionSurface(enabled = true) {
  return useQuery<DecisionSurfacePoint[]>({
    queryKey: ["decision-surface"],
    queryFn: fetchDecisionSurface,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useBoxPlot(query: TimeRangeQuery, enabled = true) {
  return useQuery<BoxPlotData[]>({
    queryKey: ["box-plot", query],
    queryFn: () => fetchBoxPlot(query),
    refetchInterval: 60_000,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBlandAltman(query: TimeRangeQuery, enabled = true) {
  return useQuery<BlandAltmanResult>({
    queryKey: ["bland-altman", query],
    queryFn: () => fetchBlandAltman(query),
    refetchInterval: 60_000,
    enabled,
    placeholderData: keepPreviousData,
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
}

async function fetchClimateFuzzyDistribution(
  query: TimeRangeQuery,
): Promise<ClimateFuzzyDistribution> {
  const params = buildTimeRangeParams(query);
  const res = await fetch(
    `${API_BASE}/analytics/climate-fuzzy-distribution?${params}`,
  );
  if (!res.ok) throw new Error("Failed to fetch climate fuzzy distribution");
  return res.json();
}

export function useClimateFuzzyDistribution(query: TimeRangeQuery, enabled = true) {
  return useQuery<ClimateFuzzyDistribution>({
    queryKey: ["climate-fuzzy-distribution", query],
    queryFn: () => fetchClimateFuzzyDistribution(query),
    refetchInterval: 60_000,
    enabled,
    placeholderData: keepPreviousData,
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
