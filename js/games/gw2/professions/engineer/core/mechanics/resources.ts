import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Calculates an interval's endurance rate after Vigor and Adrenal Implant modifiers. */
function engineerEnduranceRegenerationRate(context: EngineerRuntime, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
  const multiplier =
    1 +
    (vigor ? balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier') - 1 : 0) +
    (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)
      ? balanceProfileNumber(resourcesProfile, 'coefficientMultiplier') - 1
      : 0);
  return balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond') * multiplier;
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const engineerEndurance: EndurancePolicy<EngineerRuntime> = {
  state: (context) => professionCoreState(context),
  maximum: (context) =>
    balanceProfileNumber(
      requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources),
      'maximumStacks'
    ),
  regenerationRate: (context, vigor) => engineerEnduranceRegenerationRate(context, vigor)
};
