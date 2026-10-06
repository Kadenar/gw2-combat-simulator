import type { EndurancePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { naturalVigorBonus } from '#gw2/professions/ranger/core/traits/behavior.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Reads this invocation's profiles once; only Vigor presence changes while traversing its recovery windows. */
function rangerEnduranceRegenerationRates(context: RangerRuntime) {
  const resources = requireBalanceProfileFromContext(context, PROFILE.resources);
  const regeneration = balanceProfileNumber(resources, 'enduranceRegenerationPerSecond');
  const vigorMultiplier = balanceProfileNumber(resources, 'vigorRegenerationMultiplier');
  const naturalVigor = naturalVigorBonus(context);
  return {
    base: regeneration * (1 + naturalVigor),
    vigor: regeneration * (1 + (vigorMultiplier - 1) + naturalVigor)
  };
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const rangerEndurance: EndurancePolicy<RangerRuntime> = {
  state: (context) => professionCoreState(context).endurance,
  maximum: () => 100,
  regenerationRate: (context, vigor) => rangerEnduranceRegenerationRates(context)[vigor ? 'vigor' : 'base']
};
