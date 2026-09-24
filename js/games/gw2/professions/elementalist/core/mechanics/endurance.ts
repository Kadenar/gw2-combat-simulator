/**
 * Owns Elementalist-specific endurance regeneration policy.
 * Shared capped resource arithmetic stays in the platform endurance primitive.
 */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';

import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';

/** Resolves Elementalist's profile-aware endurance rate while leaving shared arithmetic to the GW2 primitive. */
function elementalistEnduranceRegenerationRate(context: ElementalistSchedulerContext, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const regeneration = balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier');
  return regeneration * (vigor ? vigorMultiplier : 1);
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const elementalistEndurance: EndurancePolicy<ElementalistSchedulerContext> = {
  state: (context) => professionCoreState(context),
  maximum: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks'),
  regenerationRate: (context, vigor) => elementalistEnduranceRegenerationRate(context, vigor)
};
