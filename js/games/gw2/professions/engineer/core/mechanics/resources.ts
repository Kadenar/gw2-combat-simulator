import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { adrenalImplantEnduranceBonus } from '#gw2/professions/engineer/core/traits/toolbelt.js';

import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Calculates an interval's endurance rate after Vigor and Adrenal Implant modifiers. */
function engineerEnduranceRegenerationRate(context: EngineerRuntime, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
  const multiplier =
    1 +
    (vigor ? balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier') - 1 : 0) +
    adrenalImplantEnduranceBonus(context);
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
