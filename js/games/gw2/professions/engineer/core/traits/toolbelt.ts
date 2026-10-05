import type {
  EngineerSkill,
  EngineerRuntime,
  EngineerResolverContext,
  EngineerResolverEvent
} from '#gw2/professions/engineer/types.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { advanceCounter } from '#gw2/platform/combat/resources/counters.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  balanceProfileNumber
} from '#gw2/platform/skills/balance-profiles.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { reduceEngineerRecharge } from '#gw2/professions/engineer/core/mechanics/recharge.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentId);
}

/** Applies Streamlined Kits on kit entry and adds Grenade Kit's mine strike when appropriate. */
export function applyStreamlinedKits(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (
    skill.kitTransition !== 'equip' ||
    !hasTrait(context.traits, TRAIT.STREAMLINED_KITS) ||
    !context.procs.claim(TRAIT.STREAMLINED_KITS, 'streamlinedKits', at)
  )
    return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.STREAMLINED_KITS);
  context.effects.emit({
    kind: 'profile',
    profile: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'boon' || (skill.id === ID.GRENADE_KIT && effect.type === 'strike')
    ),
    at,
    attribution: (effect) => ({
      source: 'Trait',
      sourceId: TRAIT.STREAMLINED_KITS,
      actorType: effect.type === 'strike' ? 'effect' : 'player',
      ...(effect.type === 'strike' ? { ownerActorType: 'player' } : {}),
      skillId: skill.id,
      skillName: effect.type === 'strike' ? 'Drop Mine' : skill.name
    }),
    transform: (event) =>
      event.type === 'damage'
        ? {
            ...event,
            parentSkillName: skill.name,
            name: 'Drop Mine',
            skillWeapon: 'Unequipped',
            explosion: true,
            triggeredBy: skill.name
          }
        : { ...event, name: 'Streamlined Kits — ' + event.kind }
  });
}

/** Materializes Vigor at the toolbelt dispatch boundary, including independent mech-command acceptance. */
function applyOptimizedActivation(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.traits, TRAIT.OPTIMIZED_ACTIVATION)) return;
  const optimizedActivationProfile = requireBalanceProfileFromContext(context, TRAIT.OPTIMIZED_ACTIVATION);
  const optimizedActivationVigor = requireEffect(optimizedActivationProfile, 'boon', 'vigor');
  if (optimizedActivationVigor) {
    context.effects.emit({
      kind: 'profile',
      profile: optimizedActivationProfile,
      effects: [optimizedActivationVigor],
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.OPTIMIZED_ACTIVATION,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      transform: (event) => ({ ...event, name: 'Optimized Activation — vigor' })
    });
  }
}

/** Queues Static Discharge from a completed toolbelt cast. */
function applyStaticDischarge(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.traits, TRAIT.STATIC_DISCHARGE)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.STATIC_DISCHARGE);
  context.effects.emit({
    kind: 'profile',
    profile: profile,
    at,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.STATIC_DISCHARGE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.STATIC_DISCHARGE_TRAIT_SKILL,
      skillName: 'Static Discharge',
      triggeredBy: skill.name
    },
    transform: (event) => ({
      ...event,
      parentSkillName: skill.name,
      icon: context.helpers.skillsById.get(ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || '',
      name: 'Static Discharge',
      skillWeapon: 'Unequipped',
      staticDischarge: true
    })
  });
}

/** Advances Kinetic Battery and reports charge progress after its fifth-cast buff package. */
function applyKineticBattery(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!hasTrait(context.traits, TRAIT.KINETIC_BATTERY)) return;
  const state = professionCoreState(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.KINETIC_BATTERY);
  const maximumCharges = balanceProfileNumber(profile, 'maximumStacks');
  // Start the next battery cycle before emitting its reward so reactions see the reset charge count.
  const progress = advanceCounter(state.kineticCharges, 1, maximumCharges, 'reset');
  state.kineticCharges = progress.value;
  if (progress.reached) {
    context.effects.emit({
      kind: 'profile',
      profile: profile,
      at,
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.KINETIC_BATTERY,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      },
      transform: (event) => ({
        ...event,
        name: event.kind === 'kinetic-battery' ? 'Kinetic Battery' : 'Kinetic Battery — ' + event.kind
      })
    });
  }

  buildEngineerPackets('engineer.kinetic-battery', { at, kineticCharges: state.kineticCharges }).forEach((packet) =>
    context.effects.emit({ kind: 'packet', event: packet })
  );
}

/** Applies all Core Tools traits triggered by a completed toolbelt cast in contract order. */
export function applyEngineerToolbeltTraits(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!isEngineerToolbeltSkill(skill)) return;
  applyOptimizedActivation(context, skill, at);
  applyStaticDischarge(context, skill, at);
  applyKineticBattery(context, skill, at);
}

/** Records Static Discharge when its scheduled trait strike resolves. */
export function recordStaticDischargeProc(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (event.staticDischarge !== true) return;
  // Scheduled trait damage is not a rotation step, so expose it with its toolbelt trigger in Procs.
  context.effects.emit({
    attribution: { source: 'Trait', sourceId: TRAIT.STATIC_DISCHARGE, actorType: 'effect' },
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Static Discharge',
      at: event.at,
      sourceSkill: event.parentSkillName || event.triggeredBy || event.skillName,
      detail: '',
      icon: resolverSkill(context, ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || ''
    }
  });
}

/** Dodge rewards reduce elite recharge before toolbelt recharge, after the dodge event is emitted. */
export function applyEngineerDodgeTraits(runtime: EngineerRuntime, cast: RuntimeCast<EngineerSkill>): void {
  for (const [trait, name, predicate] of [
    [TRAIT.POWER_WRENCH, 'Power Wrench', (skill: EngineerSkill) => skill.type === 'Elite' || skill.slot === 'Elite'],
    [TRAIT.ADRENAL_IMPLANT, 'Adrenal Implant', isEngineerToolbeltSkill]
  ] as const)
    if (hasTrait(runtime.traits, trait))
      reduceEngineerRecharge(
        runtime,
        cast,
        predicate,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, trait), 'rechargeReduction'),
        trait,
        name
      );
}

/** Adrenal Implant adds to Vigor using the existing resource profile's patch target. */
export function adrenalImplantEnduranceBonus(context: EngineerRuntime): number {
  return hasTrait(context.traits, TRAIT.ADRENAL_IMPLANT)
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'coefficientMultiplier') - 1
    : 0;
}

/** Adds one independently grouped mine blast before packets materialize, preserving the single control packet. */
export const gadgeteerMineVariant: NonNullable<Skill['effectVariants']>[number] = {
  profileId: TRAIT.GADGETEER,
  when: (runtime) => hasTrait(runtime, TRAIT.GADGETEER),
  transform: (_runtime, cast) =>
    (cast.skill.effects ?? []).flatMap<SkillEffect>((effect) =>
      effect.type === 'strike'
        ? [
            effect,
            {
              ...effect,
              comboFinishers: effect.comboFinishers?.map((finisher) => ({
                ...finisher,
                attemptGroup: 'gadgeteer-mine'
              }))
            }
          ]
        : [effect]
    )
};
