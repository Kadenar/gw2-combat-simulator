import { hasTrait } from '#gw2/platform/builds/selected-traits.js';

import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';

import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Unravel is unavailable without its owning trait, including when that trait is unselected. */
export function elementsOfRageAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  if (skill.id === ID.UNRAVEL && !hasTrait(context, TRAIT.ELEMENTS_OF_RAGE)) {
    return denySkillCast(skill, 'elementalist.weaver-elements-of-rage', `requires Elements of Rage.`);
  }

  return { ready: true };
}

/** Flow State supplies the flat reduction after Core's multiplier and before shared recharge-rate conversion. */
export function flowStateAttunementReduction(context: unknown): number {
  return hasTrait(context, TRAIT.FLOW_STATE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLOW_STATE), 'rechargeReduction')
    : 0;
}
