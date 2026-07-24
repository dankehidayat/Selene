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
    const pf = Math.min(1, Math.max(0, Number(cosPhi)));
    score += pf * 55;
    weight += 55;
  }
  if (hasF) {
    const f = Number(frequency);
    const dev = Math.abs(f - 50);
    const fScore = Math.max(0, 45 * (1 - dev / 1.5));
    score += fScore;
    weight += 45;
  }

  if (weight === 0) return undefined;
  return Math.round((score / weight) * 100);
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

function qualityHeadline(score: number | undefined): string {
  if (score === undefined) return "Tuning in…";
  if (score >= 80) return "Grid vibes: excellent";
  if (score >= 60) return "Grid vibes: solid";
  if (score >= 40) return "Grid vibes: a bit rocky";
  return "Grid vibes: needs love";
}

function qualityNarration(
  score: number | undefined,
  estimated: boolean,
): string {
  if (score === undefined) {
    return "We're waiting for the first electrical heartbeat from your sensors. Hang tight — the story starts when data arrives.";
  }
  let base: string;
  if (score >= 80) {
    base =
      "Your power line is humming along nicely. Factor and frequency are in a happy place — the kind of day an engineer would high-five.";
  } else if (score >= 60) {
    base =
      "Things look healthy overall. Nothing dramatic on the wire, just a steady workday for your circuits.";
  } else if (score >= 40) {
    base =
      "There's a little drama on the grid today. Worth a glance at power factor or frequency when you have a moment.";
  } else {
    base =
      "The electrical side is waving a yellow flag. Check loads, wiring, or the sensor — your gear will thank you.";
  }
  if (estimated) {
    base += " (Score estimated from cos φ and frequency.)";
  }
  return base;
}

function cosPhiNarration(cp: number | undefined): string {
  if (cp === undefined) {
    return "Power factor is still shy — no cos φ sample yet. We'll narrate once the meters speak.";
  }
  if (cp >= 0.95) {
    return `cos φ is a crisp ${cp.toFixed(2)} — almost pure real power. Your loads are sipping electricity efficiently.`;
  }
  if (cp >= 0.85) {
    return `cos φ sits at ${cp.toFixed(2)} — a polite, efficient guest at the table. Reactive power is under control.`;
  }
  if (cp >= 0.6) {
    return `cos φ is ${cp.toFixed(2)} — workable, but the grid is carrying extra “imaginary” power. Correction gear could help.`;
  }
  if (cp > 0) {
    return `cos φ is down at ${cp.toFixed(2)}. Lots of reactive power in the mix — the wire is working harder than it needs to.`;
  }
  return `cos φ is near zero (${cp.toFixed(2)}). That usually means a sensor glitch, no real load, or something worth investigating.`;
}

function frequencyNarration(freq: number | undefined): string {
  if (freq === undefined) {
    return "Frequency hasn't checked in yet. When it does, we'll tell you if the grid is dancing on beat.";
  }
  if (freq >= 49.8 && freq <= 50.2) {
    return `Frequency is a calm ${freq.toFixed(1)} Hz — right on the 50 Hz beat. The grid is keeping good time.`;
  }
  if (freq >= 49.5 && freq <= 50.5) {
    return `Frequency is ${freq.toFixed(1)} Hz — a slight wobble around 50 Hz. Not an emergency, but worth a casual watch.`;
  }
  return `Frequency is ${freq.toFixed(1)} Hz — outside the cozy 50 Hz band. Unstable grids make motors and clocks grumpy.`;
}

function consumptionNarration(kwh: string | number): string {
  if (kwh === "—" || kwh === undefined || kwh === null) {
    return "No 24-hour energy story yet. Once readings accumulate, we'll sum up how hungry the day was.";
  }
  const n = typeof kwh === "number" ? kwh : parseFloat(String(kwh));
  if (!Number.isFinite(n)) {
    return `Today's energy tally reads ${kwh} kWh — still writing the rest of the chapter.`;
  }
  if (n < 0.5) {
    return `Only ${n} kWh over the last day — a light sip. Either the office is calm or someone unplugged the party.`;
  }
  if (n < 2) {
    return `${n} kWh in the last 24 hours — a moderate day. Enough to keep the lights on without setting records.`;
  }
  if (n < 5) {
    return `${n} kWh in 24 hours — a solid workday appetite. Charts upstairs will show where the watts went.`;
  }
  return `${n} kWh over 24 hours — a hungry day on the meter. Peak hours in Analytics can reveal the main characters.`;
}

function MetricStory({
  icon: Icon,
  iconClass,
  label,
  story,
}: {
  icon: typeof Zap;
  iconClass: string;
  label: string;
  story: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <Icon size={20} className={`shrink-0 mt-0.5 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
          {story}
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

  const barWidth = derived != null ? Math.min(100, Math.max(0, derived)) : 0;
  const estimated = qualityScore == null && derived != null;

  return (
    <div className="space-y-4 mt-1">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className={`shrink-0 ${scoreTextColor(derived)}`} />
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
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
          {qualityHeadline(derived)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
          {qualityNarration(derived, estimated)}
        </p>
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-4">
        <MetricStory
          icon={Gauge}
          iconClass="text-violet-500"
          label="Power factor"
          story={cosPhiNarration(pf)}
        />
        <MetricStory
          icon={Waves}
          iconClass="text-sky-500"
          label="Frequency"
          story={frequencyNarration(freq)}
        />
        <MetricStory
          icon={Activity}
          iconClass="text-amber-500"
          label="Consumption (24h)"
          story={consumptionNarration(totalKwh)}
        />
      </div>
    </div>
  );
}
