// apps/frontend/src/components/PowerOverview.tsx
import { Activity, Gauge, Waves, Zap } from "lucide-react";

interface PowerOverviewProps {
  qualityScore: number | undefined | null;
  cosPhi: number | undefined | null;
  frequency: number | undefined | null;
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

function scoreBarColor(score: number | undefined): string {
  if (score === undefined) return "bg-gray-300 dark:bg-gray-600";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number | undefined): string {
  if (score === undefined) return "text-gray-400 dark:text-gray-500";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Single row: icon + label/value + short human hint — matches ClimateOverview. */
function MetricRow({
  icon: Icon,
  iconClass,
  label,
  value,
  unit,
  hint,
}: {
  icon: typeof Zap;
  iconClass: string;
  label: string;
  value: string;
  unit?: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <Icon size={20} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {label}
          </span>
          <span className="text-xl font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">
            {value}
            {unit ? (
              <span className="text-sm font-semibold text-gray-900 dark:text-white ml-0.5">
                {unit}
              </span>
            ) : null}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
          {hint}
        </p>
      </div>
    </div>
  );
}

export function PowerOverview({
  qualityScore,
  cosPhi,
  frequency,
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

  const kwhValue =
    totalKwh !== "—" && totalKwh !== undefined && totalKwh !== null
      ? String(totalKwh)
      : "—";

  const barWidth =
    derived != null ? Math.min(100, Math.max(0, derived)) : 0;

  return (
    <div className="space-y-4 mt-1">
      {/* Quality narrative — glanceable hero, no tile grid */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className={`shrink-0 ${scoreTextColor(derived)}`} />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Power quality
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-3xl font-semibold tabular-nums tracking-tight ${scoreTextColor(derived)}`}
          >
            {derived != null ? derived.toFixed(0) : "—"}
          </span>
          <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
            / 100
          </span>
        </div>
        <div
          className="mt-2.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={derived ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Power quality score"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${scoreBarColor(derived)}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className={`text-sm font-semibold mt-2.5 ${scoreTextColor(derived)}`}>
          {derived != null
            ? derived >= 80
              ? "Excellent"
              : derived >= 60
                ? "Good"
                : derived >= 40
                  ? "Fair"
                  : "Poor"
            : "—"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          {getQualityLabel(derived)}
          {qualityScore == null && derived != null
            ? " Estimated from cos φ and frequency."
            : ""}
        </p>
      </div>

      {/* Live electrical + energy summary — same rhythm as ClimateOverview */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <MetricRow
          icon={Gauge}
          iconClass="text-violet-500"
          label="cos φ (power factor)"
          value={pf != null ? pf.toFixed(2) : "—"}
          hint={getCosPhiLabel(pf)}
        />
        <MetricRow
          icon={Waves}
          iconClass="text-sky-500"
          label="Frequency"
          value={freq != null ? freq.toFixed(1) : "—"}
          unit={freq != null ? "Hz" : undefined}
          hint={getFrequencyLabel(freq)}
        />
        <MetricRow
          icon={Activity}
          iconClass="text-amber-500"
          label="Consumption (24h)"
          value={kwhValue}
          unit={kwhValue !== "—" ? "kWh" : undefined}
          hint={
            kwhValue !== "—"
              ? "Integrated active power over the last 24 hours"
              : "No energy summary yet"
          }
        />
      </div>
    </div>
  );
}
