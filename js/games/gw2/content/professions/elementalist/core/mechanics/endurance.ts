import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';
import type { ElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import { ENDURANCE_PER_SECOND } from '#gw2/content/professions/elementalist/core/constants.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import { advanceEndurance } from '#gw2/platform/combat/resources/endurance.js';

/** Resolves Elementalist's profile-aware endurance rate while leaving shared arithmetic to the GW2 primitive. */
export function elementalistEnduranceRegenerationRate(context: ElementalistSchedulerContext, vigor: boolean): number {
  const regeneration = balanceProfileValueFromContext(
    context,
    PROFILE.resources,
    'enduranceRegenerationPerSecond',
    ENDURANCE_PER_SECOND
  );
  const vigorMultiplier = balanceProfileValueFromContext(
    context,
    PROFILE.resources,
    'vigorRegenerationMultiplier',
    1.5
  );
  return regeneration * (vigor ? vigorMultiplier : 1);
}

/** Advances Elementalist endurance using its effective local rate and the standard capped GW2 update contract. */
export function updateEndurance(
  context: ElementalistSchedulerContext,
  state: ElementalistCoreState,
  at: number,
  vigor: boolean
): void {
  const maximum = balanceProfileValueFromContext(context, PROFILE.resources, 'maximumStacks', 100);
  Object.assign(state, advanceEndurance(state, at, elementalistEnduranceRegenerationRate(context, vigor), maximum));
}
