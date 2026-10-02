import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  selectedMechCommand,
  engineerMechResolverEvent,
  isEngineerMechCommand
} from '#gw2/professions/engineer/specializations/mechanist/mechanics/mech-ownership.js';
import type {
  EngineerConfig,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerRuntime,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  applyEngineerDerivedCondition,
  queueBuff,
  recordTrait
} from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { mechanistState } from '#gw2/professions/engineer/specializations/mechanist/state.js';
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

/** Accepted mech hits resolve arm procs in order using independent, effect-aware cooldown slots. */
export function reactToMechArmDamage(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = context.procs.readyAt;
  if (!engineerMechResolverEvent(context, event)) return;

  if (
    hasTrait(context, TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS) &&
    isInternalCooldownReady(event.at, state.singleEdgeCutters || 0)
  ) {
    const mechArmsSingleEdgeCuttersProfile = requireBalanceProfileFromContext(
      context,
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS
    );
    const packet = requireEffect(mechArmsSingleEdgeCuttersProfile, 'condition', 'Bleeding');
    if (packet) {
      // A removed arm effect cannot consume its own proc cooldown.
      state.singleEdgeCutters = event.at + balanceProfileNumber(mechArmsSingleEdgeCuttersProfile, 'internalCooldown');
      applyEngineerDerivedCondition(context, event, {
        name: 'Mech Arms: Single-Edge Cutters',
        condition: String(packet.condition),
        stacks: Number(packet.stacks),
        duration: Number(packet.duration),
        sourceId: TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        actorType: 'summon',
        metadata: { engineerMech: true }
      });

      recordTrait(context, 'Mech Arms: Single-Edge Cutters', event);
    }
  }

  if (
    hasTrait(context, TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS) &&
    isInternalCooldownReady(event.at, state.highImpactDrivers || 0)
  ) {
    const mechArmsHighImpactDriversProfile = requireBalanceProfileFromContext(
      context,
      TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS
    );
    const packet = requireEffect(mechArmsHighImpactDriversProfile, 'boon', 'might');
    if (packet) {
      state.highImpactDrivers = event.at + balanceProfileNumber(mechArmsHighImpactDriversProfile, 'internalCooldown');
      queueBuff(context, event, {
        name: 'Mech Arms: High-Impact Drivers',
        kind: String(packet.boon).toLowerCase(),
        stacks: Number(packet.stacks),
        duration: packet.duration,
        sourceId: TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
        actorType: 'effect'
      });

      recordTrait(context, 'Mech Arms: High-Impact Drivers', event);
    }
  }

  if (event.mechBasicAttack === true && hasTrait(context, TRAIT.MECH_ARMS_JADE_CANNONS)) {
    const mechArmsJadeCannonsProfile = requireBalanceProfileFromContext(context, TRAIT.MECH_ARMS_JADE_CANNONS);
    const vulnerability = requireEffect(mechArmsJadeCannonsProfile, 'condition', 'Vulnerability');
    if (vulnerability)
      applyEngineerDerivedCondition(context, event, {
        name: 'Mech Arms: Jade Cannons',
        condition: String(vulnerability.condition),
        stacks: Number(vulnerability.stacks),
        duration: Number(vulnerability.duration),
        sourceId: TRAIT.MECH_ARMS_JADE_CANNONS,
        actorType: 'summon',
        metadata: { engineerMech: true }
      });
  }
}

/** Invoke the canonical Rocket Punch payload with its own summon activation and trait attribution. */
function emitRocketPunch(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  // The trait invokes the skill payload with a separate summon activation and native weapon roll.
  const punch = context.helpers.skillsById.get(ID.ROCKET_PUNCH_MECH)!;
  emitEffects(context, {
    owner: punch,
    at,
    skillWeaponFallback: 'Unequipped',
    baseEvent: {
      source: 'Trait',
      sourceId: TRAIT.MECH_FIGHTER,
      actorType: 'summon',
      skillId: punch.id,
      skillName: punch.name,
      activationId: 'engineer.rocket-punch:' + at,
      triggeredBy: skill.name,
      metadata: { engineerMech: true }
    }
  });
}

/** Weapon slot three invokes Rocket Punch after command recovery, retaining the minor trait's existing implicit eligibility. */
export function triggerMechFighter(context: EngineerRuntime, skill: EngineerSkill): void {
  const state = mechanistState.from(context);
  const at = context.time;
  if (
    state.mech.active &&
    skill.type === 'Weapon' &&
    !skill.kitId &&
    skill.slot === 'Weapon_3' &&
    context.procs.claim(TRAIT.MECH_FIGHTER, 'rocketPunch', at)
  ) {
    // The weapon trigger owns the interval even when Rocket Punch's optional strike is removed.
    emitRocketPunch(context, skill, at);
  }
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
export function overclockPassive(context: EngineerRuntime, skill: EngineerSkill): boolean {
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
export function ordinaryOverclockEligible(context: EngineerRuntime, skill: EngineerSkill): boolean {
  return (
    !(isEngineerMechCommand(skill) && hasTrait(context, TRAIT.MECH_CORE_JADE_DYNAMO)) &&
    !hasTrait(context, TRAIT.MECH_CORE_J_DRIVE)
  );
}

/** Force Signet keeps its existing profile identity while J-Drive chooses the improved value. */
export function forceSignetDamage(context: Gw2ModifierContext): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.forceSignet);
  return balanceProfileNumber(
    profile,
    hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 'activeDamageIncrease' : 'damageIncrease'
  );
}

/** Superconducting's two existing passive strengths share J-Drive's selection owner. */
export function superconductingSignetDamage(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.MECH_CORE_J_DRIVE) ? 0.12 : 0.1;
}
