/** Owns imperative Core Engineer Tools effects while keeping hook registration in the public dispatcher. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import {
  ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  engineerBalanceEffectValue
} from '#gw2/content/professions/engineer/core/profiles.js';
import { resolverSkill } from '#gw2/content/professions/engineer/core/mechanics/state-helpers.js';
import type {
  EngineerCastContext,
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerSchedulerContext,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentName);
}

/** Applies Streamlined Kits on kit entry and adds Grenade Kit's mine strike when appropriate. */
export function applyStreamlinedKits(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  const state = professionCoreState(context);
  if (
    skill.handlerId !== 'engineer.kit-equip' ||
    !hasTrait(context.config, TRAIT.STREAMLINED_KITS) ||
    !isInternalCooldownReady(at, Number(state.traitProcReadyAt.streamlinedKits || 0))
  )
    return;
  state.traitProcReadyAt.streamlinedKits =
    at + balanceProfileValueFromContext(context, PROFILE.streamlinedKits, 'internalCooldown', 20);
  // Every eligible kit entry grants the shared swiftness effect.
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.STREAMLINED_KITS,
    actorType: 'player',
    name: 'Streamlined Kits — swiftness',
    kind: 'swiftness',
    duration: engineerBalanceEffectValue(context, PROFILE.streamlinedKits, 'boon', 'duration', 20),
    stacks: 1
  });
  // Grenade Kit additionally drops the trait's mine strike on entry.
  if ((skill.kitName || skill.name) === 'Grenade Kit') {
    emitSkillDamage(context, {
      at,
      source: 'Trait',
      sourceId: TRAIT.STREAMLINED_KITS,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: 'Drop Mine',
      parentSkillName: skill.name,
      name: 'Drop Mine',
      coefficient: engineerBalanceEffectValue(context, PROFILE.streamlinedKits, 'strike', 'coefficient', 1.75),
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: 'Unequipped',
      explosion: true,
      triggeredBy: skill.name
    });
  }
}

/** Grants Optimized Activation vigor for a completed toolbelt cast. */
export function applyOptimizedActivation(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.OPTIMIZED_ACTIVATION)) return;
  emitSkillBuff(context, skill, {
    at,
    source: 'Trait',
    sourceId: TRAIT.OPTIMIZED_ACTIVATION,
    actorType: 'player',
    name: 'Optimized Activation — vigor',
    kind: 'vigor',
    duration: engineerBalanceEffectValue(context, PROFILE.optimizedActivation, 'boon', 'duration', 4),
    stacks: 1
  });
}

/** Queues Static Discharge from a completed toolbelt cast. */
export function applyStaticDischarge(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.STATIC_DISCHARGE)) return;
  emitSkillDamage(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.STATIC_DISCHARGE,
    actorType: 'effect',
    ownerActorType: 'player',
    skillId: ID.STATIC_DISCHARGE_TRAIT_SKILL,
    skillName: 'Static Discharge',
    parentSkillName: skill.name,
    icon: context.catalog.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || '',
    name: 'Static Discharge',
    coefficient: engineerBalanceEffectValue(context, PROFILE.staticDischarge, 'strike', 'coefficient', 0.33),
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    // Static Discharge uses the unequipped weapon-strength profile, not its tooltip weapon.
    skillWeapon: 'Unequipped',
    staticDischarge: true,
    triggeredBy: skill.name
  });
}

/** Advances Kinetic Battery and emits its fifth-cast buff package plus a state snapshot. */
export function applyKineticBattery(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.config, TRAIT.KINETIC_BATTERY)) return;
  const state = professionCoreState(context);
  const maximumCharges = balanceProfileValueFromContext(context, PROFILE.kineticBattery, 'maximumStacks', 5);
  state.kineticCharges = Math.min(maximumCharges, Number(state.kineticCharges || 0) + 1);
  // Proc quickness and reset charges every fifth toolbelt cast.
  if (state.kineticCharges >= maximumCharges) {
    state.kineticCharges = 0;
    const buffDuration = engineerBalanceEffectValue(context, PROFILE.kineticBattery, 'buff', 'duration', 5);
    emitSkillBuff(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.KINETIC_BATTERY,
      actorType: 'player',
      name: 'Kinetic Battery',
      kind: 'kinetic-battery',
      duration: buffDuration,
      stacks: 1
    });
    emitSkillBuff(context, skill, {
      at,
      source: 'Trait',
      sourceId: TRAIT.KINETIC_BATTERY,
      actorType: 'player',
      name: 'Kinetic Battery — quickness',
      kind: 'quickness',
      duration: engineerBalanceEffectValue(context, PROFILE.kineticBattery, 'boon', 'duration', 5),
      stacks: 1
    });
  }

  emitStateSnapshot(context, 'engineer', at, 'kinetic-battery', snapshotEngineerState(context.state.profession));
}

/** Applies all Core Tools traits triggered by a completed toolbelt cast in contract order. */
export function applyEngineerToolbeltTraits(context: EngineerSchedulerContext, skill: EngineerSkill, at: number): void {
  if (!isEngineerToolbeltSkill(skill)) return;
  applyOptimizedActivation(context, skill, at);
  applyStaticDischarge(context, skill, at);
  applyKineticBattery(context, skill, at);
}

/** Records Static Discharge when its scheduled trait strike resolves. */
export function recordStaticDischargeProc(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.staticDischarge !== true) return;
  // Scheduled trait damage is not a rotation step, so expose it with its toolbelt trigger in Procs.
  context.recordProc?.(
    'trait',
    'Static Discharge',
    event.at,
    event.parentSkillName || event.triggeredBy || event.skillName,
    '',
    resolverSkill(context, ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || ''
  );
}
