import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  selectedMechCommand,
  isEngineerMechCommand
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import type { EngineerConfig, EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';
import { overclockSignetApplies } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MECHANIST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/mechanist/profiles.js';

/** Choose this command row in its existing priority order, retaining the first option for an empty selection. */
export function mechArmsCommand(traits: EngineerConfig | ReadonlySet<SkillId>): SkillId {
  return selectedMechCommand(traits, [
    [TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS, ID.ROLLING_SMASH],
    [TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS, ID.EXPLOSIVE_KNUCKLE],
    [TRAIT.MECH_ARMS_JADE_CANNONS, ID.SPARK_REVOLVER]
  ]);
}

/** Jade Cannons replaces the basic chain while the mechanic retains attack emission and scheduling. */
export function jadeCannonsAttack(
  config: EngineerConfig,
  phase: number
): { skillId: SkillId; interval: number; nextPhase: number } | undefined {
  if (!hasTrait(config, TRAIT.MECH_ARMS_JADE_CANNONS)) return;
  const firstArm = phase === 0;
  return {
    skillId: firstArm ? ID.JADE_ENERGY_SHOT : ID.JADE_ENERGY_SHOT_ID_63348,
    interval: firstArm ? MECHANIST_ATTACK_TIMING.jadeCannonArmGap : MECHANIST_ATTACK_TIMING.jadeCannonCycleGap,
    nextPhase: firstArm ? 1 : 0
  };
}

/** Choose this command row in its existing priority order, retaining the first option for an empty selection. */
export function mechCoreCommand(traits: EngineerConfig | ReadonlySet<SkillId>): SkillId {
  return selectedMechCommand(traits, [
    [TRAIT.MECH_CORE_JADE_DYNAMO, ID.JADE_MORTAR],
    [TRAIT.MECH_CORE_BARRIER_ENGINE, ID.BARRIER_BURST],
    [TRAIT.MECH_CORE_J_DRIVE, ID.SKY_CIRCUS]
  ]);
}

/** Jade Dynamo owns command recharge before J-Drive may improve an equipped Overclock passive. */
export function overclockPassive(context: MechanicQueriesOf<EngineerRuntime>, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    overclockSignetApplies(context, skill)
  );
}

/** J-Drive retains equipped signet passives while they recharge. */
export function signetPassiveAvailable(context: unknown, ready: boolean): boolean {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) || ready;
}

/** Ordinary Overclock applies only when neither trait owns the recharge adjustment. */
export function ordinaryOverclockEligible(context: MechanicQueriesOf<EngineerRuntime>, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    !hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
  );
}

/** The signet owns its base passive; J-Drive owns the replacement bonus while selected. */
export function forceSignetDamage(context: Gw2ModifierContext): number {
  const owner = hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? TRAIT.MECH_CORE_J_DRIVE : PROFILE.forceSignet;
  return balanceProfileNumber(requireBalanceProfileFromContext(context, owner), 'damageIncrease');
}

/** The selected trait balance supplies Superconducting's improved passive without a second literal rate. */
export function superconductingSignetDamage(context: Gw2ModifierContext): number {
  const owner = hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? TRAIT.MECH_CORE_J_DRIVE : PROFILE.superconductingSignet;
  return balanceProfileNumber(requireBalanceProfileFromContext(context, owner), 'conditionDamageIncrease');
}
