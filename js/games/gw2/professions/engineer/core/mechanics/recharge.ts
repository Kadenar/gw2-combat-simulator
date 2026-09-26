import type { RechargeRule } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { EngineerRuntimeState } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/traits/tools.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Toolbelt reductions take precedence over Gadgeteer when a skill belongs to both categories. */
export const engineerRechargeRules: readonly RechargeRule<EngineerRuntimeState>[] = [
  {
    trait: TRAIT.MECHANIZED_DEPLOYMENT,
    when: (_runtime, skill) => isEngineerToolbeltSkill(skill),
    multiplier: { profile: TRAIT.MECHANIZED_DEPLOYMENT, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.GADGETEER,
    when: (runtime, skill) =>
      !(isEngineerToolbeltSkill(skill) && hasTrait(runtime, TRAIT.MECHANIZED_DEPLOYMENT)) &&
      Boolean(skill.categories?.some((category) => category.toLowerCase() === 'gadget')),
    multiplier: { profile: TRAIT.GADGETEER, field: 'rechargeMultiplier' }
  }
];
