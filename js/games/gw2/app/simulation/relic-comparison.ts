import type { ChartPoint } from '#gw2/app/results/charts/time-series-model.js';

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
  readonly durationMs: number;
  readonly opponentDps: readonly ChartPoint[];
  readonly targetDps: readonly ChartPoint[];
  /** Fight time before which crossovers are ignored as opener noise. */
  readonly crossoverStartMs?: number;
}

/** Interpolates the exact crossing time between samples that straddle a target-minus-opponent sign change. */
function interpolateCrossing(previous: RelicComparisonPoint, current: RelicComparisonPoint): number {
  const previousDelta = previous.targetDps - previous.opponentDps;
  const currentDelta = current.targetDps - current.opponentDps;
  const span = previousDelta - currentDelta;
  if (!(Math.abs(span) > 0)) return current.tMs;
  const fraction = Math.max(0, Math.min(1, previousDelta / span));
  return previous.tMs + (current.tMs - previous.tMs) * fraction;
}

/** Zips two cumulative DPS curves and finds when the selected target relic stays ahead. */
export function buildRelicComparisonModel({
  opponentRelic,
  targetRelic,
  durationMs,
  opponentDps,
  targetDps,
  crossoverStartMs = CROSSOVER_EVALUATION_START_MS
}: RelicComparisonModelInput): RelicComparisonModel {
  const length = Math.min(opponentDps.length, targetDps.length);
  const points: RelicComparisonPoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const opponent = Number(opponentDps[index]?.v ?? 0);
    const target = Number(targetDps[index]?.v ?? 0);
    // Leading zeroes are not a meaningful tie before either relic deals damage.
    if (!(opponent > 0) || !(target > 0)) continue;
    points.push({
      tMs: Number(opponentDps[index]?.t ?? targetDps[index]?.t ?? 0),
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
    opponentFinalDps: Number(points.at(-1)?.opponentDps ?? 0),
    targetFinalDps: Number(points.at(-1)?.targetDps ?? 0)
  };
}
