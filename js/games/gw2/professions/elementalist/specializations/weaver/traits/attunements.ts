import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { elementalistAttunements } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistModifierContext, ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

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

/** Apply each distinct active attunement once, including Water's Healing Power bonus. */
export function applyElementalPolyphonyAttributes(
  context: ElementalistModifierContext,
  attributes: Gw2Stats
): Gw2Stats {
  if (!hasTrait(context, TRAIT.ELEMENTAL_POLYPHONY)) return attributes;
  const modified = { ...attributes };
  const active = elementalistAttunements(context);
  const secondary =
    readProfessionSpecializationState<{
      secondaryAttunement?: string;
    }>(context.runtime?.profession, 'Weaver')?.secondaryAttunement ?? context.config?.secondaryAttunement;
  if (typeof secondary === 'string') active.add(secondary);
  const elementalPolyphonyProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_POLYPHONY);
  const attributeBonus = balanceProfileNumber(elementalPolyphonyProfile, 'attributeBonus');
  if (active.has('Fire')) {
    modified.power = (modified.power || 0) + attributeBonus;
  }

  if (active.has('Air')) {
    modified.ferocity = (modified.ferocity || 0) + attributeBonus;
  }

  if (active.has('Water')) {
    modified.healingPower = (modified.healingPower || 0) + attributeBonus;
  }

  if (active.has('Earth')) {
    modified.conditionDamage = (modified.conditionDamage || 0) + attributeBonus;
  }

  return modified;
}

/** Flow State supplies the flat reduction after Core's multiplier and before shared recharge-rate conversion. */
export function flowStateAttunementReduction(context: unknown): number {
  return hasTrait(context, TRAIT.FLOW_STATE)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLOW_STATE), 'rechargeReduction')
    : 0;
}
