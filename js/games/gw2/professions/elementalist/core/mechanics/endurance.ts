/**
 * Owns Elementalist-specific endurance regeneration policy.
 * Shared capped resource arithmetic stays in the platform endurance primitive.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import type { ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  vigorEnduranceIntervals
} from '#gw2/platform/combat/resources/endurance.js';

/** Resolves Elementalist's profile-aware endurance rate while leaving shared arithmetic to the GW2 primitive. */
export function elementalistEnduranceRegenerationRate(context: ElementalistSchedulerContext, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const regeneration = balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier');
  return regeneration * (vigor ? vigorMultiplier : 1);
}

/** Maps shared, cancellation-aware self-Vigor windows to local rates for both recovery and dodge readiness. */
function enduranceIntervals(context: ElementalistSchedulerContext, start: number, end: number) {
  const baseRate = elementalistEnduranceRegenerationRate(context, false);
  const vigorRate = elementalistEnduranceRegenerationRate(context, true);
  return vigorEnduranceIntervals(context, start, end, (vigor) => (vigor ? vigorRate : baseRate));
}

/** Advances capped endurance across each rate interval without rewinding an already settled timestamp. */
export function updateEndurance(context: ElementalistSchedulerContext, state: ElementalistCoreState, at: number): void {
  if (at <= state.enduranceUpdatedAt) return;

  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const maximum = balanceProfileNumber(resourcesProfile, 'maximumStacks');
  Object.assign(
    state,
    advanceEnduranceIntervals(state, enduranceIntervals(context, state.enduranceUpdatedAt, at), maximum)
  );
}

/** Projects the first affordable dodge across known Vigor windows, including recovery after expiry. */
export function elementalistEnduranceReadyAt(
  context: ElementalistSchedulerContext,
  current: number,
  cost: number,
  at: number
): number | null {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  return enduranceIntervalsReadyAt(
    { endurance: current, enduranceUpdatedAt: at },
    cost,
    enduranceIntervals(context, at, Infinity),
    balanceProfileNumber(resourcesProfile, 'maximumStacks')
  );
}
