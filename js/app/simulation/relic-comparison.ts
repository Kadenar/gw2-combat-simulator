import type { ChartPoint } from '../../platform/ui/results/charts/time-series.js';

/**
 * Relic of Thorns ramps its Condition Damage bonus over the first ~48s and then
 * holds. Against relics with front-loaded or flat value, that produces a genuine
 * fight-duration break-even: short fights favour the opponent, long fights favour
 * Thorns. This module builds an opt-in comparison of the two relics' cumulative
 * average-DPS curves (each already produced by a single simulation) and locates
 * the crossover.
 *
 * The opponent set is intentionally an allowlist so the control only appears for
 * relics where the trade-off is interesting. Add new relic keys here to extend it.
 */
export const RELIC_COMPARISON_TARGET = 'Thorns';

export const THORNS_COMPARISON_OPPONENTS: ReadonlySet<string> = new Set(['Fractal', 'Akeem']);

/**
 * Ignore crossovers inside the opener. Cumulative average DPS swings wildly over
 * the first few seconds (a single burst skill dominates a tiny elapsed window),
 * and Thorns has not begun ramping until 3s, so any crossing there is noise
 * rather than a real fight-duration break-even.
 */
export const CROSSOVER_EVALUATION_START_MS = 8000;

/** True when a Thorns break-even comparison is meaningful for the equipped relic. */
export function relicComparisonAvailable(relic: string | null | undefined): boolean {
  const name = String(relic || '');
  return name !== RELIC_COMPARISON_TARGET && THORNS_COMPARISON_OPPONENTS.has(name);
}

export interface RelicComparisonPoint {
  /** Milliseconds into the DPS window (fight duration if the fight ended here). */
  readonly tMs: number;
  readonly opponentDps: number;
  readonly thornsDps: number;
}

export interface RelicComparisonModel {
  readonly opponentRelic: string;
  readonly targetRelic: string;
  readonly durationMs: number;
  readonly points: readonly RelicComparisonPoint[];
  /**
   * Fight duration (ms) beyond which Thorns is reliably the better pick — the
   * final opponent-ahead → Thorns-ahead crossing. Null when the opponent leads
   * at the end (Thorns never catches up) or when Thorns is never behind
   * (`thornsAlwaysAhead`).
   */
  readonly crossoverMs: number | null;
  /** True when Thorns matches or beats the opponent across the whole window. */
  readonly thornsAlwaysAhead: boolean;
  /**
   * Fight time from which the comparison is meaningful — charts clamp to this so
   * the volatile opener (a huge first-hit average that plunges) does not stretch
   * the axes.
   */
  readonly evaluationStartMs: number;
  readonly opponentFinalDps: number;
  readonly thornsFinalDps: number;
}

export interface RelicComparisonModelInput {
  readonly opponentRelic: string;
  readonly durationMs: number;
  readonly opponentDps: readonly ChartPoint[];
  readonly thornsDps: readonly ChartPoint[];
  /** Fight time before which crossovers are ignored as opener noise. */
  readonly crossoverStartMs?: number;
}

/**
 * Interpolates the exact crossing time between two samples that straddle a
 * sign change in (thorns - opponent).
 */
function interpolateCrossing(previous: RelicComparisonPoint, current: RelicComparisonPoint): number {
  const previousDelta = previous.thornsDps - previous.opponentDps;
  const currentDelta = current.thornsDps - current.opponentDps;
  const span = previousDelta - currentDelta;

  // Guard against a zero span (both samples equal) — fall back to the later time.
  if (!(Math.abs(span) > 0)) return current.tMs;
  const fraction = Math.max(0, Math.min(1, previousDelta / span));
  return previous.tMs + (current.tMs - previous.tMs) * fraction;
}

/**
 * Builds the break-even model by zipping two cumulative average-DPS curves that
 * share a rotation (and therefore a common time grid), then finding the first
 * fight duration at which Thorns is no longer behind.
 */
export function buildRelicComparisonModel({
  opponentRelic,
  durationMs,
  opponentDps,
  thornsDps,
  crossoverStartMs = CROSSOVER_EVALUATION_START_MS
}: RelicComparisonModelInput): RelicComparisonModel {
  const length = Math.min(opponentDps.length, thornsDps.length);
  const points: RelicComparisonPoint[] = [];
  for (let index = 0; index < length; index += 1) {
    const opponent = Number(opponentDps[index]?.v ?? 0);
    const thorns = Number(thornsDps[index]?.v ?? 0);

    // Skip leading samples before both relics have dealt damage. Their
    // cumulative average DPS is still 0, and 0 >= 0 would otherwise register a
    // spurious crossover at t=0.
    if (!(opponent > 0) || !(thorns > 0)) continue;
    points.push({
      tMs: Number(opponentDps[index]?.t ?? thornsDps[index]?.t ?? 0),
      opponentDps: opponent,
      thornsDps: thorns
    });
  }

  // Evaluate crossovers only past the opener (see CROSSOVER_EVALUATION_START_MS).
  // If the rotation is shorter than the threshold, fall back to the whole window
  // rather than reporting nothing.
  const firstEvalIndex = points.findIndex((point) => point.tMs >= crossoverStartMs);
  const evalStart = firstEvalIndex >= 0 ? firstEvalIndex : 0;

  // The decision point is the *last* time the opponent is strictly ahead within
  // the evaluation window: for any fight longer than that, Thorns leads. Using
  // the last crossing (rather than the first) is robust to tick-to-tick wobble.
  let lastOpponentAheadIndex = -1;
  for (let index = evalStart; index < points.length; index += 1) {
    if (points[index].opponentDps > points[index].thornsDps) lastOpponentAheadIndex = index;
  }

  let crossoverMs: number | null = null;
  let thornsAlwaysAhead = false;

  if (lastOpponentAheadIndex === -1) {
    // Thorns is never strictly behind across the evaluation window.
    thornsAlwaysAhead = points.length > evalStart;
  } else if (lastOpponentAheadIndex < points.length - 1) {
    // Opponent leads here but not at the end: interpolate the final crossing.
    crossoverMs = interpolateCrossing(points[lastOpponentAheadIndex], points[lastOpponentAheadIndex + 1]);
  }
  // Otherwise the opponent still leads at the final sample: no crossover.

  const evaluationStartMs = firstEvalIndex >= 0 ? points[firstEvalIndex].tMs : Number(points[0]?.tMs ?? 0);
  const opponentFinalDps = Number(points.at(-1)?.opponentDps ?? 0);
  const thornsFinalDps = Number(points.at(-1)?.thornsDps ?? 0);
  return {
    opponentRelic,
    targetRelic: RELIC_COMPARISON_TARGET,
    durationMs,
    points,
    crossoverMs,
    thornsAlwaysAhead,
    evaluationStartMs,
    opponentFinalDps,
    thornsFinalDps
  };
}
