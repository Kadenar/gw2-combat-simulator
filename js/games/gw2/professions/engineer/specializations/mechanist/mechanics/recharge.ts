import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { ENGINEER_TRAIT_IDS as TRAIT, ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { isEngineerMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Applies Jade Dynamo and Overclock/J-Drive recharge reductions to eligible Mechanist skills. */
export function mechanistRechargeWork(context: EngineerRuntime, skill: EngineerSkill, duration: number): number {
  if (isEngineerMechCommand(skill) && hasTrait(context.config, TRAIT.MECH_CORE_JADE_DYNAMO)) {
    const jadeDynamoProfile = requireBalanceProfileFromContext(context, PROFILE.jadeDynamo);
    return duration * balanceProfileNumber(jadeDynamoProfile, 'rechargeMultiplier');
  }

  // Overclock Signet passively reduces other signet recharges while selected
  // and ready; J-Drive keeps the passive active while Overclock is recharging.
  if (
    skill?.id !== ID.OVERCLOCK_SIGNET &&
    skill?.categories?.some((category) => String(category).toLowerCase() === 'signet')
  ) {
    const overclockReadyAt = Number(context.cooldowns.get(ID.OVERCLOCK_SIGNET) || 0);
    const jDrive = hasTrait(context.config, TRAIT.MECH_CORE_J_DRIVE);
    if (
      selectedSkillNameSet(context.config?.selectedSkills).has('Overclock Signet') &&
      (jDrive || overclockReadyAt <= Number(context.time))
    ) {
      // J-Drive improves Overclock's 20% passive reduction to 24%.
      return duration * (jDrive ? 0.76 : 0.8);
    }
  }

  return duration;
}
