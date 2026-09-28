import type { ChartPoint } from '#gw2/app/results/charts/time-series-model.js';
import { chartValueAt } from '#gw2/app/results/charts/time-series-model.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';
import { clamp } from '#kernel/core/numeric.js';

export interface RelicDamageSummary {
  readonly buildDps: number;
  readonly directDamage: number;
  readonly contributedDps: number;
}

/** Direct relic packets come from the breakdown; removing the relic also captures its buffs and interactions. */
export function relicDamageSummary(result: Gw2SimulationResult, withoutRelicDps: number): RelicDamageSummary {
  return {
    buildDps: result.dps,
    directDamage: result.breakdown
      .filter((entry) => entry.source === 'Relic' || entry.name.startsWith('Relic of '))
      .reduce((sum, entry) => sum + entry.damage, 0),
    contributedDps: result.dps - withoutRelicDps
  };
}

/** Ignore volatile opener crossovers that do not represent a useful fight-duration decision. */
export const CROSSOVER_EVALUATION_START_MS = 8000;

/** A comparison needs two distinct, selected relics. */
export function relicComparisonAvailable(
  opponentRelic: string | null | undefined,
  targetRelic: string | null | undefined
): boolean {
  const opponent = String(opponentRelic || '');
  const target = String(targetRelic || '');
  return Boolean(opponent && target && opponent !== target);
}

export interface RelicComparisonPoint {
  /** Milliseconds into the DPS window (fight duration if the fight ended here). */
  readonly tMs: number;
  readonly opponentDps: number;
  readonly targetDps: number;
}

export interface RelicComparisonModel {
  readonly opponentDamage?: RelicDamageSummary;
  readonly targetDamage?: RelicDamageSummary;
  readonly opponentRelic: string;
  readonly targetRelic: string;
  readonly durationMs: number;
  readonly points: readonly RelicComparisonPoint[];
  /** Final opponent-ahead to target-ahead crossing, after which the target stays ahead. */
  readonly crossoverMs: number | null;
  /** True when the target relic matches or beats the opponent across the evaluation window. */
  readonly targetAlwaysAhead: boolean;
  /** Fight time from which the comparison is meaningful. */
  readonly evaluationStartMs: number;
  readonly opponentFinalDps: number;
  readonly targetFinalDps: number;
}

export interface RelicComparisonModelInput {
  readonly opponentRelic: string;
  readonly targetRelic: string;
  readonly opponentDps: readonly ChartPoint[];
  readonly targetDps: readonly ChartPoint[];
  readonly opponentFinalDps: number;
  readonly targetFinalDps: number;
  /** Fight time before which crossovers are ignored as opener noise. */
  readonly crossoverStartMs?: number;
}

/** Interpolates the exact crossing time between samples that straddle a target-minus-opponent sign change. */
function interpolateCrossing(previous: RelicComparisonPoint, current: RelicComparisonPoint): number {
  const previousDelta = previous.targetDps - previous.opponentDps;
  const currentDelta = current.targetDps - current.opponentDps;
  const span = previousDelta - currentDelta;
  if (!(Math.abs(span) > 0)) return current.tMs;
  const fraction = clamp(previousDelta / span, 0, 1);
  return previous.tMs + (current.tMs - previous.tMs) * fraction;
}

/** Samples both curves within their shared window; final simulation DPS stays independent of chart samples. */
export function buildRelicComparisonModel({
  opponentRelic,
  targetRelic,
  opponentDps,
  targetDps,
  opponentFinalDps,
  targetFinalDps,
  crossoverStartMs = CROSSOVER_EVALUATION_START_MS
}: RelicComparisonModelInput): RelicComparisonModel {
  const durationMs = Math.min(opponentDps.at(-1)?.t ?? 0, targetDps.at(-1)?.t ?? 0);
  const startMs = Math.max(opponentDps[0]?.t ?? 0, targetDps[0]?.t ?? 0);
  const times = [...new Set([...opponentDps, ...targetDps].map((point) => point.t))]
    .filter((time) => time >= startMs && time <= durationMs)
    .sort((left, right) => left - right);
  const points: RelicComparisonPoint[] = [];
  for (const tMs of times) {
    const opponent = chartValueAt(opponentDps, tMs);
    const target = chartValueAt(targetDps, tMs);
    // Leading zeroes are not a meaningful tie before either relic deals damage.
    if (!(opponent > 0) || !(target > 0)) continue;
    points.push({
      tMs,
      opponentDps: opponent,
      targetDps: target
    });
  }

  const firstEvalIndex = points.findIndex((point) => point.tMs >= crossoverStartMs);
  const evalStart = firstEvalIndex >= 0 ? firstEvalIndex : 0;

  // Use the last opponent lead so the result remains stable across tick-to-tick wobble.
  let lastOpponentAheadIndex = -1;
  for (let index = evalStart; index < points.length; index += 1) {
    if (points[index].opponentDps > points[index].targetDps) lastOpponentAheadIndex = index;
  }

  let crossoverMs: number | null = null;
  let targetAlwaysAhead = false;
  if (lastOpponentAheadIndex === -1) {
    targetAlwaysAhead = points.length > evalStart;
  } else if (lastOpponentAheadIndex < points.length - 1) {
    crossoverMs = interpolateCrossing(points[lastOpponentAheadIndex], points[lastOpponentAheadIndex + 1]);
  }

  const evaluationStartMs = firstEvalIndex >= 0 ? points[firstEvalIndex].tMs : Number(points[0]?.tMs ?? 0);
  return {
    opponentRelic,
    targetRelic,
    durationMs,
    points,
    crossoverMs,
    targetAlwaysAhead,
    evaluationStartMs,
    opponentFinalDps,
    targetFinalDps
  };
}
