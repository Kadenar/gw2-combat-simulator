import type { RechargeRule } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { RangerRuntimeState } from '#gw2/professions/ranger/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';

/** Recharge rules inspect Quick Draw before its acceptance owner consumes the grant. */
export const rangerRechargeRules: readonly RechargeRule<RangerRuntimeState>[] = [
  {
    trait: TRAIT.QUICK_DRAW,
    when: (runtime, skill) =>
      skill.type === 'Weapon' && skill.slot !== 'Weapon_1' && runtime.profession.core.quickDrawUntil > runtime.time,
    multiplier: { profile: PROFILE.quickDraw, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.HONED_AXES,
    when: (_runtime, skill) => skill.weapon === 'Axe',
    multiplier: { profile: PROFILE.honedAxes, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.LIGHT_ON_YOUR_FEET,
    when: (_runtime, skill) => skill.weapon === 'Shortbow',
    multiplier: { profile: PROFILE.lightOnYourFeet, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.LEAD_THE_WIND,
    when: (_runtime, skill) => skill.weapon === 'Longbow',
    multiplier: { profile: PROFILE.leadTheWind, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.AMBIDEXTERITY,
    when: (_runtime, skill) => ['Dagger', 'Torch'].includes(String(skill.weapon)),
    multiplier: { profile: PROFILE.ambidexterity, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.PACK_ALPHA,
    when: (_runtime, skill) => Boolean(skill.petSkill),
    multiplier: { profile: PROFILE.packAlpha, field: 'rechargeMultiplier' }
  }
];
