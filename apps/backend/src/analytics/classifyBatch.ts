// Chunked fuzzy classification so long ranges never block the event loop.
import {
  classifyEnergyFuzzy,
  classifyClimateFuzzy,
  generateBoxPlotData,
  generateBlandAltmanData,
  type EnergyCategory,
  type ClimateCategory,
} from "./fuzzy";

const YIELD_EVERY = 250;

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Reservoir sample — O(n), fixed memory. */
function reservoirPush<T>(
  reservoir: T[],
  max: number,
  seen: number,
  item: T,
): void {
  if (reservoir.length < max) {
    reservoir.push(item);
    return;
  }
  const j = Math.floor(Math.random() * (seen + 1));
  if (j < max) reservoir[j] = item;
}

export type EnergyReadingLike = {
  timestamp?: string;
  acVoltage: number;
  acPower: number;
  cosPhi: number;
  reactivePower: number;
};

export type ClimateReadingLike = {
  timestamp?: string;
  temperature: number;
  humidity: number;
};

export async function classifyEnergyDistribution(
  data: EnergyReadingLike[],
  opts: { scatterMax?: number; boxMax?: number; blandMax?: number } = {},
) {
  const scatterMax = opts.scatterMax ?? 500;
  const boxMax = opts.boxMax ?? 400;
  const blandMax = opts.blandMax ?? 400;

  const distribution: Record<EnergyCategory, number> = {
    ECONOMICAL: 0,
    NORMAL: 0,
    WASTEFUL: 0,
  };
  const scatterData: Array<{
    power: number;
    powerFactor: number;
    category: string;
  }> = [];
  const boxSamples: Array<{ power: number; category: string }> = [];
  const blandInput: Array<{
    voltage: number;
    power: number;
    pf: number;
    reactive: number;
  }> = [];

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const fuzzy = classifyEnergyFuzzy(
      r.acVoltage,
      r.acPower,
      r.cosPhi,
      r.reactivePower,
    );
    distribution[fuzzy.category]++;
    reservoirPush(
      scatterData,
      scatterMax,
      i,
      {
        power: r.acPower,
        powerFactor: r.cosPhi,
        category: fuzzy.category,
      },
    );
    reservoirPush(boxSamples, boxMax, i, {
      power: r.acPower,
      category: fuzzy.category,
    });
    reservoirPush(blandInput, blandMax, i, {
      voltage: r.acVoltage,
      power: r.acPower,
      pf: r.cosPhi,
      reactive: r.reactivePower,
    });

    if (i > 0 && i % YIELD_EVERY === 0) await yieldEventLoop();
  }

  const blandAltman =
    blandInput.length > 0
      ? generateBlandAltmanData(blandInput)
      : {
          data: [] as Array<{ mean: number; difference: number }>,
          meanDiff: 0,
          upperLoA: 0,
          lowerLoA: 0,
        };

  // Cap bland-altman plot points further if generate returns more
  if (blandAltman.data.length > blandMax) {
    blandAltman.data = blandAltman.data.slice(0, blandMax);
  }

  return {
    distribution,
    total: data.length,
    scatterData,
    boxSamples,
    boxPlot: generateBoxPlotData(boxSamples),
    blandAltman,
  };
}

export async function classifyClimateDistribution(
  data: ClimateReadingLike[],
  opts: { scatterMax?: number } = {},
) {
  const scatterMax = opts.scatterMax ?? 500;
  const distribution: Record<ClimateCategory, number> = {
    COLD: 0,
    COOL: 0,
    COMFORTABLE: 0,
    WARM: 0,
    HOT: 0,
  };
  const scatterData: Array<{
    temperature: number;
    humidity: number;
    category: string;
  }> = [];

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const fuzzy = classifyClimateFuzzy(r.temperature, r.humidity);
    distribution[fuzzy.category]++;
    reservoirPush(scatterData, scatterMax, i, {
      temperature: r.temperature,
      humidity: r.humidity,
      category: fuzzy.category,
    });
    if (i > 0 && i % YIELD_EVERY === 0) await yieldEventLoop();
  }

  return {
    distribution,
    total: data.length,
    scatterData,
  };
}
