import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';

import { ENGINEER_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/engineer/core/profiles.js';
import type { EngineerSchedulerContext } from '#gw2/professions/engineer/types.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { advanceProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Calculates an interval's endurance rate after Vigor and Adrenal Implant modifiers. */
function engineerEnduranceRegenerationRate(context: EngineerSchedulerContext, vigor: boolean): number {
  const resourcesProfile = requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources);
  const multiplier =
    1 +
    (vigor ? balanceProfileNumber(resourcesProfile, 'vigorRegenerationMultiplier') - 1 : 0) +
    (hasTrait(context.config, TRAIT.ADRENAL_IMPLANT)
      ? balanceProfileNumber(resourcesProfile, 'coefficientMultiplier') - 1
      : 0);
  return balanceProfileNumber(resourcesProfile, 'enduranceRegenerationPerSecond') * multiplier;
}

/** Advances Core endurance to a target time and emits the updated Engineer state. */
export function advanceEngineerResources(context: EngineerSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  advanceProfessionEndurance(context, target);

  emitEngineerStateSnapshot(context, target, 'resources');
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const engineerEndurance: EndurancePolicy<EngineerSchedulerContext> = {
  state: (context) => professionCoreState(context),
  maximum: (context) =>
    balanceProfileNumber(
      requireBalanceProfileFromContext(context, ENGINEER_CORE_BALANCE_PROFILE_IDS.resources),
      'maximumStacks'
    ),
  regenerationRate: (context, vigor) => engineerEnduranceRegenerationRate(context, vigor)
};
