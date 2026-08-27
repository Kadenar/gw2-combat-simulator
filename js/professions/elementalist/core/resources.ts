import type { ElementalistSchedulerContext } from '../types.js';
import type { ElementalistCoreState } from './state.js';
import { ENDURANCE_PER_SECOND } from './constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';
import { advanceEndurance } from '../../../platform/gw2/combat/resources/endurance.js';

/** Resolves Elementalist's profile-aware endurance rate while leaving shared arithmetic to the GW2 primitive. */
export function elementalistEnduranceRegenerationRate(context: ElementalistSchedulerContext, vigor: boolean): number {
  const regeneration = elementalistBalanceValue(
    context,
    PROFILE.resources,
    'enduranceRegenerationPerSecond',
    ENDURANCE_PER_SECOND
  );
  const vigorMultiplier = elementalistBalanceValue(context, PROFILE.resources, 'vigorRegenerationMultiplier', 1.5);
  return regeneration * (vigor ? vigorMultiplier : 1);
}

/** Advances Elementalist endurance using its effective local rate and the standard capped GW2 update contract. */
export function updateEndurance(
  context: ElementalistSchedulerContext,
  state: ElementalistCoreState,
  at: number,
  vigor: boolean
): void {
  const maximum = elementalistBalanceValue(context, PROFILE.resources, 'maximumStacks', 100);
  Object.assign(state, advanceEndurance(state, at, elementalistEnduranceRegenerationRate(context, vigor), maximum));
}
