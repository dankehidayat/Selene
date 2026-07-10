// [apps/backend] src/analytics/fuzzy.ts
export type EnergyCategory = "ECONOMICAL" | "NORMAL" | "WASTEFUL";

export interface FuzzyResult {
  category: EnergyCategory;
  confidence: number;
  strengths: { economical: number; normal: number; wasteful: number };
}

export function classifyEnergyFuzzy(
  voltage: number,
  power: number,
  pf: number,
  reactivePower: number,
): FuzzyResult {
  let v_low = 0,
    v_normal = 0,
    v_high = 0;
  if (voltage <= 200) v_low = 1.0;
  else if (voltage <= 210) v_low = (210 - voltage) / 10.0;
  if (voltage >= 205 && voltage <= 220) v_normal = (voltage - 205) / 15.0;
  else if (voltage > 220 && voltage <= 235) v_normal = (235 - voltage) / 15.0;
  if (voltage >= 235) v_high = 1.0;
  else if (voltage >= 230) v_high = (voltage - 230) / 5.0;

  let p_eco = 0,
    p_norm = 0,
    p_waste = 0;
  if (power <= 20) p_eco = 1.0;
  else if (power <= 30) p_eco = (30 - power) / 10.0;
  if (power >= 25 && power <= 47.5) p_norm = (power - 25) / 22.5;
  else if (power > 47.5 && power <= 70) p_norm = (70 - power) / 22.5;
  if (power >= 80) p_waste = 1.0;
  else if (power >= 60) p_waste = (power - 60) / 20.0;

  let pf_poor = 0,
    pf_fair = 0,
    pf_good = 0;
  if (pf <= 0.5) pf_poor = 1.0;
  else if (pf <= 0.6) pf_poor = (0.6 - pf) / 0.1;
  if (pf >= 0.55 && pf <= 0.7) pf_fair = (pf - 0.55) / 0.15;
  else if (pf > 0.7 && pf <= 0.85) pf_fair = (0.85 - pf) / 0.15;
  if (pf >= 0.9) pf_good = 1.0;
  else if (pf >= 0.8) pf_good = (pf - 0.8) / 0.1;

  let r_low = 0,
    r_med = 0,
    r_high = 0;
  if (reactivePower <= 15) r_low = 1.0;
  else if (reactivePower <= 25) r_low = (25 - reactivePower) / 10.0;
  if (reactivePower >= 20 && reactivePower <= 37.5)
    r_med = (reactivePower - 20) / 17.5;
  else if (reactivePower > 37.5 && reactivePower <= 55)
    r_med = (55 - reactivePower) / 17.5;
  if (reactivePower >= 60) r_high = 1.0;
  else if (reactivePower >= 45) r_high = (reactivePower - 45) / 15.0;

  let eco = 0,
    norm = 0,
    waste = 0;
  eco = Math.max(eco, Math.min(p_eco, pf_good));
  eco = Math.max(eco, Math.min(p_eco, r_low));
  eco = Math.max(eco, Math.min(p_eco, v_normal));
  eco = Math.max(eco, Math.min(pf_good, r_low));
  norm = Math.max(norm, Math.min(p_norm, pf_fair));
  norm = Math.max(norm, Math.min(p_norm, v_normal));
  norm = Math.max(norm, Math.min(p_norm, r_med));
  norm = Math.max(norm, Math.min(pf_fair, v_normal));
  norm = Math.max(norm, Math.min(p_eco, pf_poor));
  waste = Math.max(waste, p_waste);
  waste = Math.max(waste, pf_poor);
  waste = Math.max(waste, r_high);
  waste = Math.max(waste, Math.max(v_low, v_high));
  waste = Math.max(waste, Math.min(p_norm, pf_poor));
  waste = Math.max(waste, Math.min(p_waste, r_high));

  const strengths = [eco, norm, waste];
  const categories: EnergyCategory[] = ["ECONOMICAL", "NORMAL", "WASTEFUL"];
  return {
    category: categories[strengths.indexOf(Math.max(...strengths))],
    confidence: Math.max(...strengths),
    strengths: { economical: eco, normal: norm, wasteful: waste },
  };
}

export function generateMembershipData() {
  const voltageRange = Array.from({ length: 61 }, (_, i) => 190 + i);
  const powerRange = Array.from({ length: 151 }, (_, i) => i);

  const voltageMembership = voltageRange.map((v) => {
    let low = 0,
      normal = 0,
      high = 0;
    if (v <= 200) low = 1;
    else if (v <= 210) low = (210 - v) / 10;
    if (v >= 205 && v <= 220) normal = (v - 205) / 15;
    else if (v > 220 && v <= 235) normal = (235 - v) / 15;
    if (v >= 235) high = 1;
    else if (v >= 230) high = (v - 230) / 5;
    return {
      x: v,
      low: +low.toFixed(3),
      normal: +normal.toFixed(3),
      high: +high.toFixed(3),
    };
  });

  const powerMembership = powerRange.map((p) => {
    let eco = 0,
      norm = 0,
      waste = 0;
    if (p <= 20) eco = 1;
    else if (p <= 30) eco = (30 - p) / 10;
    if (p >= 25 && p <= 47.5) norm = (p - 25) / 22.5;
    else if (p > 47.5 && p <= 70) norm = (70 - p) / 22.5;
    if (p >= 80) waste = 1;
    else if (p >= 60) waste = (p - 60) / 20;
    return {
      x: p,
      economical: +eco.toFixed(3),
      normal: +norm.toFixed(3),
      wasteful: +waste.toFixed(3),
    };
  });

  return { voltageMembership, powerMembership };
}

export function generateDecisionSurface() {
  const pRange = Array.from({ length: 25 }, (_, i) => i * 5);
  const pfRange = Array.from(
    { length: 15 },
    (_, i) => +(0.3 + i * 0.05).toFixed(2),
  );

  const surface: Array<{ power: number; pf: number; category: string }> = [];

  for (const pf of pfRange) {
    for (const power of pRange) {
      const result = classifyEnergyFuzzy(220, power, pf, 20);
      surface.push({ power, pf, category: result.category });
    }
  }

  return surface;
}

export function generateBoxPlotData(
  data: Array<{ power: number; category: string }>,
) {
  const categories = ["ECONOMICAL", "NORMAL", "WASTEFUL"];

  return categories
    .map((cat) => {
      const values = data
        .filter((d) => d.category === cat)
        .map((d) => d.power)
        .sort((a, b) => a - b);
      if (values.length === 0) return null;

      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const lowerWhisker = Math.max(values[0], q1 - 1.5 * iqr);
      const upperWhisker = Math.min(values[values.length - 1], q3 + 1.5 * iqr);

      return {
        category: cat,
        min: +lowerWhisker.toFixed(1),
        q1: +q1.toFixed(1),
        median: +values[Math.floor(values.length * 0.5)].toFixed(1),
        q3: +q3.toFixed(1),
        max: +upperWhisker.toFixed(1),
        count: values.length,
      };
    })
    .filter(Boolean);
}

export function generateBlandAltmanData(
  data: Array<{ voltage: number; power: number; pf: number; reactive: number }>,
) {
  const results: Array<{ mean: number; difference: number }> = [];

  for (const row of data) {
    const fuzzy = classifyEnergyFuzzy(
      row.voltage,
      row.power,
      row.pf,
      row.reactive,
    );
    let thresholdScore = 0;
    if (row.power <= 30) thresholdScore = 1;
    else if (row.power <= 70) thresholdScore = 2;
    else thresholdScore = 3;

    const fuzzyScore =
      fuzzy.category === "ECONOMICAL" ? 1 : fuzzy.category === "NORMAL" ? 2 : 3;
    const mean = (fuzzyScore + thresholdScore) / 2;
    const difference = fuzzyScore - thresholdScore;
    results.push({
      mean: +mean.toFixed(2),
      difference: +difference.toFixed(2),
    });
  }

  const diffs = results.map((r) => r.difference);
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const stdDiff = Math.sqrt(
    diffs.reduce((a, b) => a + (b - meanDiff) ** 2, 0) / diffs.length,
  );

  return {
    data: results,
    meanDiff: +meanDiff.toFixed(3),
    upperLoA: +(meanDiff + 1.96 * stdDiff).toFixed(3),
    lowerLoA: +(meanDiff - 1.96 * stdDiff).toFixed(3),
  };
}
