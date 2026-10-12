import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2SimulationResult, Gw2SimulationPlanningState } from '#gw2/platform/results/types.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { gw2EventActorType, isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';

/**
 * Finds a player strike or player-owned derived effect whose resolved critical chance
 * represents the requested rotation time, preferring the next eligible strike over the last.
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
    const actor = gw2EventActorType(event);
    // Only effects explicitly owned by the player join player actors in this sample.
    if (actor !== 'player' && (actor !== 'effect' || !isGw2PlayerModifierOwnedEvent(event))) continue;
    // Match combat-query's independent critical profile: attribution alone does not imply player stats.
    if (
      event.independentSummonStrike === true &&
      event.summonInheritsAttributes !== true &&
      event.summonInheritsCriticalAttributes !== true
    )
      continue;
    // Flat ticks and other non-critical packets report zero chance, which must
    // not replace the player strike being inspected.
    if (event.type !== 'damage' || event.critEligible !== true) continue;
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
