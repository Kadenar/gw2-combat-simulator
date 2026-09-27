import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Reads this invocation's profiles once; only Vigor presence changes while traversing its recovery windows. */
function rangerEnduranceRegenerationRates(context: RangerRuntime) {
  const resources = requireBalanceProfileFromContext(context, PROFILE.resources);
  const regeneration = balanceProfileNumber(resources, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resources, 'vigorRegenerationMultiplier');
  const naturalVigor = hasTrait({ config: context.config }, TRAIT.NATURAL_VIGOR)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, PROFILE.naturalVigor),
        'vigorRegenerationMultiplier'
      )
    : 0;
  return {
    base: regeneration * (1 + naturalVigor),
    vigor: regeneration * (1 + (vigorMultiplier - 1) + naturalVigor)
  };
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const rangerEndurance: EndurancePolicy<RangerRuntime> = {
  state: (context) => professionCoreState(context),
  maximum: () => 100,
  regenerationRate: (context, vigor) => rangerEnduranceRegenerationRates(context)[vigor ? 'vigor' : 'base']
};
