import type { SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { selectedMechCommand } from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-queries.js';
import type { EngineerConfig } from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MECHANIST_ATTACK_TIMING } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';

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
