// apps/frontend/src/components/PowerOverview.tsx
import { Zap, Activity, Gauge, DollarSign, Waves } from "lucide-react";

interface PowerOverviewProps {
  qualityScore: number | undefined | null;
  cosPhi: number | undefined | null;
  frequency: number | undefined | null;
  estimatedCost: string;
  totalKwh: string | number;
}

/** Derive 0–100 quality when backend leaves powerQualityScore null (MQTT path). */
export function computePowerQualityScore(
  cosPhi?: number | null,
  frequency?: number | null,
): number | undefined {
  const hasPf = cosPhi != null && !Number.isNaN(Number(cosPhi));
  const hasF = frequency != null && !Number.isNaN(Number(frequency));
  if (!hasPf && !hasF) return undefined;

  let score = 0;
  let weight = 0;

  if (hasPf) {
    // PF 0.4→0 … 1.0→55
    const pf = Math.min(1, Math.max(0, Number(cosPhi)));
    score += pf * 55;
    weight += 55;
  }
  if (hasF) {
    const f = Number(frequency);
    // 50 Hz ideal; ±0.2 → full 45 pts, falls off to 0 by ±1.5 Hz
    const dev = Math.abs(f - 50);
    const fScore = Math.max(0, 45 * (1 - dev / 1.5));
    score += fScore;
    weight += 45;
  }

  if (weight === 0) return undefined;
  return Math.round((score / weight) * 100);
}

function getQualityLabel(score: number | undefined): string {
  if (score === undefined) return "Waiting for live electrical readings";
  if (score >= 80) return "Excellent — power quality is very good";
  if (score >= 60) return "Good — within acceptable range";
  if (score >= 40) return "Fair — some parameters need attention";
  return "Poor — power quality needs improvement";
}

function getCosPhiLabel(cp: number | undefined): string {
  if (cp === undefined) return "No PF sample yet";
  if (cp >= 0.85) return "Good — efficient power usage";
  if (cp >= 0.6) return "Fair — consider PF correction";
  if (cp > 0) return "Low — significant reactive power";
  return "Near zero — check load / sensor wiring";
}

function getFrequencyLabel(freq: number | undefined): string {
  if (freq === undefined) return "No frequency sample yet";
  if (freq >= 49.8 && freq <= 50.2) return "Stable — within normal range";
  if (freq >= 49.5 && freq <= 50.5)
    return "Slight deviation — monitoring recommended";
  return "Unstable — outside normal grid band";
}

function getCostContext(cost: string, kwh: string | number): string {
  if (cost === "—" || kwh === "—") return "No 24h summary yet";
  const n = typeof kwh === "number" ? kwh : parseFloat(String(kwh));
  if (!Number.isFinite(n)) return "Estimated from 24h energy";
  if (n < 0.5) return "Very low consumption today";
  if (n < 2) return "Moderate consumption today";
  return "Higher than usual consumption";
}

function scoreTone(score: number | undefined): string {
  if (score === undefined) return "bg-gray-100 dark:bg-gray-800 text-gray-500";
  if (score >= 80) return "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
  if (score >= 40) return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
  return "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400";
}

function MetricTile({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof Zap;
  iconClass: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 px-3.5 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}
        >
          <Icon size={14} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums leading-tight">
        {value}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
        {hint}
      </p>
    </div>
  );
}

export function PowerOverview({
  qualityScore,
  cosPhi,
  frequency,
  estimatedCost,
  totalKwh,
}: PowerOverviewProps) {
  const derived =
    qualityScore != null && !Number.isNaN(Number(qualityScore))
      ? Number(qualityScore)
      : computePowerQualityScore(cosPhi, frequency);

  const pf =
    cosPhi != null && !Number.isNaN(Number(cosPhi))
      ? Number(cosPhi)
      : undefined;
  const freq =
    frequency != null && !Number.isNaN(Number(frequency))
      ? Number(frequency)
      : undefined;

  const kwhDisplay =
    totalKwh !== "—" && totalKwh !== undefined && totalKwh !== null
      ? `${totalKwh} kWh`
      : "—";

  return (
    <div className="space-y-4 mt-0.5">
      {/* Quality hero */}
      <div
        className={`rounded-2xl px-4 py-4 ${scoreTone(derived)}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap size={15} className="shrink-0 opacity-80" />
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
            Power Quality Score
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">
          {derived != null ? derived.toFixed(0) : "—"}
          <span className="text-base font-medium opacity-60">/100</span>
        </p>
        <p className="text-xs mt-1.5 opacity-80 leading-snug">
          {getQualityLabel(derived)}
        </p>
        {qualityScore == null && derived != null && (
          <p className="text-[10px] mt-1.5 opacity-60">
            Estimated from cos φ & frequency
          </p>
        )}
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <MetricTile
          icon={Gauge}
          iconClass="bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400"
          label="cos φ"
          value={pf != null ? pf.toFixed(2) : "—"}
          hint={getCosPhiLabel(pf)}
        />
        <MetricTile
          icon={Waves}
          iconClass="bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400"
          label="Frequency"
          value={freq != null ? `${freq.toFixed(1)} Hz` : "—"}
          hint={getFrequencyLabel(freq)}
        />
        <MetricTile
          icon={DollarSign}
          iconClass="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
          label="Energy Cost (24h)"
          value={estimatedCost}
          hint={getCostContext(estimatedCost, totalKwh)}
        />
        <MetricTile
          icon={Activity}
          iconClass="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
          label="Consumption (24h)"
          value={kwhDisplay}
          hint={
            totalKwh !== "—"
              ? "Integrated active power over last 24 hours"
              : "No energy summary yet"
          }
        />
      </div>
    </div>
  );
}
