import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationResult, Gw2SimulationPlanningState } from '#gw2/platform/simulation/types.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { canonicalTime } from '#kernel/core/clock.js';

/**
 * Finds the player strike whose resolved critical chance best represents a
 * requested rotation time, preferring the next eligible strike over the last.
 */
export function criticalChanceEventAt(
  result: Gw2SimulationResult | null | undefined,
  timeMs: number
): Gw2ResolverEvent | null {
  const seconds = (timeMs || 0) / 1000;
  let after: Gw2ResolverEvent | null = null;
  let afterAt = Infinity;
  let before: Gw2ResolverEvent | null = null;
  let beforeAt = -Infinity;
  for (const event of result?.resolvedEvents || []) {
    if (event.independentSummonStrike === true) continue;
    if (event.source === 'Clone' || event.source === 'Phantasm') continue;
    // Flat ticks and other non-critical packets report zero chance, which must
    // not replace the player strike being inspected.
    if (event.critEligible === false) continue;
    const chance = Number(event.criticalChance);
    if (!Number.isFinite(chance)) continue;
    const at = event.at || 0;
    if (at >= seconds) {
      if (at < afterAt) {
        afterAt = at;
        after = event;
      }
    } else if (at > beforeAt) {
      beforeAt = at;
      before = event;
    }
  }

  return after ?? before;
}

/** A prefix simulation supplies one planning boundary beyond combat; arbitrary future queries remain unavailable. */
function observedBuffAt(result: Gw2SimulationResult, kind: string, at: number) {
  if (!result.effectReport) throw new TypeError('Historical effect queries require chart data.');
  const matches = (state: { kind: string; recipient: string; origin: string }) =>
    state.kind === kind.toLowerCase() && state.recipient === 'self' && state.origin === 'simulated';
  if (at > result.effectReport.end && canonicalTime(at) === canonicalTime(result.planningState.atSeconds)) {
    const state = result.planningState.effects.find(matches);
    return state ? effectStateValue(state, at) : null;
  }

  const track = result.effectReport.tracks.find(matches);
  return track ? effectStateAt(result.effectReport, track, at) : null;
}

/** Cursor inspection uses the same accepted state and deadlines as effect charts. */
export function timedBuffAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): { readonly remaining: number; readonly event?: SimulationEvent } | null {
  if (!result) return null;
  const state = observedBuffAt(result, kind, Math.max(0, atSeconds));
  return state && state.count > 0
    ? { remaining: state.expiresAt == null ? Infinity : Math.max(0, state.expiresAt - atSeconds), event: state.source }
    : null;
}

/** Effective counts are supplied by the engine owner, including consumption and replacements. */
export function timedBuffStacksAt(
  result: Gw2SimulationResult | null | undefined,
  kind: string,
  atSeconds: number
): number {
  if (!result) return 0;
  return observedBuffAt(result, kind, Math.max(0, atSeconds))?.count ?? 0;
}

/** Read the inspected engine boundary directly; editor state remains available without chart histories. */
export function planningBuffAt(state: Gw2SimulationPlanningState | null | undefined, kind: string) {
  const effect = state?.effects.find(
    (effect) => effect.kind === kind.toLowerCase() && effect.recipient === 'self' && effect.origin === 'simulated'
  );
  if (!state || !effect) return null;
  const value = effectStateValue(effect, state.atSeconds);
  return value.count > 0
    ? {
        count: value.count,
        remaining: value.expiresAt == null ? Infinity : Math.max(0, value.expiresAt - state.atSeconds),
        event: value.source
      }
    : null;
}

/** Stack labels use the same detached boundary observation as duration labels. */
export function planningBuffStacks(state: Gw2SimulationPlanningState | null | undefined, kind: string): number {
  return planningBuffAt(state, kind)?.count ?? 0;
}
