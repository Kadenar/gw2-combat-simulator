import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { ENGINEER_TRAIT_IDS as TRAIT, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { isEngineerMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import type { EngineerRuntime, EngineerRuntimeState, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Jade Dynamo takes precedence; Overclock's selected passive persists during recharge only with J-Drive. */
function overclockPassive(context: EngineerRuntime, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    skill.id !== ID.OVERCLOCK_SIGNET &&
    Boolean(skill.categories?.some((category) => String(category).toLowerCase() === 'signet')) &&
    selectedSkillNameSet(context.config.selectedSkills).has('Overclock Signet')
  );
}

export const mechanistRechargeWork = compileRechargeRules<EngineerRuntimeState>([
  {
    trait: TRAIT.MECH_CORE_JADE_DYNAMO,
    when: (_context, skill) => isEngineerMechCommand(skill),
    multiplier: { profile: PROFILE.jadeDynamo, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.MECH_CORE_J_DRIVE,
    when: overclockPassive,
    multiplier: { profile: TRAIT.MECH_CORE_J_DRIVE, field: 'rechargeMultiplier' }
  },
  {
    when: (context, skill) =>
      overclockPassive(context, skill) &&
      !hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) &&
      Number(context.cooldowns.get(ID.OVERCLOCK_SIGNET) || 0) <= context.time,
    multiplier: { profile: PROFILE.overclock, field: 'rechargeMultiplier' }
  }
]);
