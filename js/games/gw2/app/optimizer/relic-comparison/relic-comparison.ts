/** Compares any number of relics on one clock and one no-relic baseline. */
import type { ChartPoint } from '#gw2/app/results/charts/time-series-model.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import { clamp } from '#kernel/core/numeric.js';

export const CROSSOVER_EVALUATION_START_MS = 8000;

export function relicComparisonAvailable(
  equippedRelic: string | null | undefined,
  relics: readonly string[],
  relicNames: readonly string[]
): boolean {
  return Boolean(
    equippedRelic && relics.length && relics.every((relic) => relic !== equippedRelic && relicNames.includes(relic))
  );
}

export interface RelicComparisonSample {
  readonly buildDps: number;
  readonly directDps: number;
  readonly gainedDps: number;
}

export interface RelicComparisonPoint {
  readonly tMs: number;
  /** Samples follow the model's relic order, with the equipped relic first. */
  readonly samples: readonly RelicComparisonSample[];
}

export interface RelicKillResult {
  readonly killTimeMs: number | null;
  readonly observedMs: number;
}

export interface RelicComparisonEntry {
  readonly relic: string;
  readonly kill: RelicKillResult;
  /** Last crossing against the equipped relic, bounded by the displayed window. */
  readonly crossoverMs: number | null;
}

export interface RelicComparisonModel {
  readonly equippedRelic: string;
  readonly relics: readonly RelicComparisonEntry[];
  readonly durationMs: number;
  readonly points: readonly RelicComparisonPoint[];
  readonly evaluationStartMs: number;
  readonly targetHealthPercent: number;
}

export interface RelicComparisonRun {
  readonly relic: string;
  readonly dps: readonly ChartPoint[];
  readonly directDps: readonly ChartPoint[];
  readonly kill: RelicKillResult;
}

export interface RelicComparisonModelInput {
  readonly runs: readonly RelicComparisonRun[];
  readonly withoutRelicDps: readonly ChartPoint[];
  readonly targetHealthPercent: number;
}

/** Retains zero and negative gains; every selected relic subtracts the same no-relic sample. */
export function buildRelicComparisonModel({
  runs,
  withoutRelicDps,
  targetHealthPercent
}: RelicComparisonModelInput): RelicComparisonModel {
  const series = [...runs.map((run) => run.dps), withoutRelicDps];
  const durationMs = Math.min(...series.map((values) => values.at(-1)?.t ?? 0));
  const times = [...new Set(series.flatMap((values) => values.map((point) => point.t)))]
    .filter((time) => time > 0 && time <= durationMs)
    .sort((left, right) => left - right);
  const points = times.map((tMs): RelicComparisonPoint => {
    const baseline = chartValueAt(withoutRelicDps, tMs);
    return {
      tMs,
      samples: runs.map((run) => ({
        buildDps: chartValueAt(run.dps, tMs),
        directDps: chartValueAt(run.directDps, tMs),
        gainedDps: chartValueAt(run.dps, tMs) - baseline
      }))
    };
  });
  const evalStart = Math.max(
    0,
    points.findIndex((point) => point.tMs >= CROSSOVER_EVALUATION_START_MS)
  );
  const relics = runs.map((run, relicIndex): RelicComparisonEntry => {
    let lastBehindIndex = -1;
    for (let index = evalStart; index < points.length; index += 1) {
      if (points[index].samples[0].gainedDps > points[index].samples[relicIndex].gainedDps) lastBehindIndex = index;
    }

    let crossoverMs: number | null = null;

    if (lastBehindIndex >= 0 && lastBehindIndex < points.length - 1) {
      const previous = points[lastBehindIndex];
      const current = points[lastBehindIndex + 1];
      const previousDelta = previous.samples[relicIndex].gainedDps - previous.samples[0].gainedDps;
      const currentDelta = current.samples[relicIndex].gainedDps - current.samples[0].gainedDps;
      const fraction = clamp(previousDelta / (previousDelta - currentDelta), 0, 1);
      crossoverMs = previous.tMs + (current.tMs - previous.tMs) * fraction;
    }

    return { relic: run.relic, kill: run.kill, crossoverMs };
  });
  return {
    equippedRelic: runs[0]?.relic ?? '',
    relics,
    durationMs,
    points,
    evaluationStartMs: points[evalStart]?.tMs ?? 0,
    targetHealthPercent
  };
}
