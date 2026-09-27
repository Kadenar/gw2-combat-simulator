/** Owns imperative Core Engineer Tools effects while keeping hook registration in the public dispatcher. */
/** Owns imperative Core Engineer Tools effects while keeping hook registration in the public dispatcher. */
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/events.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';

import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';
import { resolverSkill } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import type {
  EngineerResolverContext,
  EngineerResolverEvent,
  EngineerRuntime,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';

/** Detects explicit specialization toolbelt skills and ordinary parent-linked toolbelt skills. */
export function isEngineerToolbeltSkill(skill: EngineerSkill | undefined): boolean {
  return skill?.countsAsToolbeltSkill ?? Boolean(skill?.toolbeltParentName);
}

/** Applies Streamlined Kits on kit entry and adds Grenade Kit's mine strike when appropriate. */
export function applyStreamlinedKits(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (
    skill.kitTransition !== 'equip' ||
    !hasTrait(context.config, TRAIT.STREAMLINED_KITS) ||
    !context.procs.claim(PROFILE.streamlinedKits, 'streamlinedKits', at)
  )
    return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.streamlinedKits);
  emitEffects(context, {
    owner: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'boon' || (skill.id === ID.GRENADE_KIT && effect.type === 'strike')
    ),
    at,
    baseEvent: (effect) => ({
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
  if (!hasTrait(context.config, TRAIT.OPTIMIZED_ACTIVATION)) return;
  const optimizedActivationProfile = requireBalanceProfileFromContext(context, PROFILE.optimizedActivation);
  const optimizedActivationVigor = requireEffect(optimizedActivationProfile, 'boon', 'vigor');
  if (optimizedActivationVigor) {
    emitEffects(context, {
      owner: optimizedActivationProfile,
      effects: [optimizedActivationVigor],
      at,
      baseEvent: {
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
  if (!hasTrait(context.config, TRAIT.STATIC_DISCHARGE)) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.staticDischarge);
  emitEffects(context, {
    owner: profile,
    at,
    baseEvent: {
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
  if (!hasTrait(context.config, TRAIT.KINETIC_BATTERY)) return;
  const state = professionCoreState(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.kineticBattery);
  const maximumCharges = balanceProfileNumber(profile, 'maximumStacks');
  state.kineticCharges = Math.min(maximumCharges, (state.kineticCharges || 0) + 1);
  if (state.kineticCharges >= maximumCharges) {
    state.kineticCharges = 0;
    emitEffects(context, {
      owner: profile,
      at,
      baseEvent: {
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

  emitEngineerEvent(context, 'engineer.kinetic-battery', { at, kineticCharges: state.kineticCharges });
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
  context.recordProc(
    'trait',
    'Static Discharge',
    event.at,
    event.parentSkillName || event.triggeredBy || event.skillName,
    '',
    resolverSkill(context, ID.STATIC_DISCHARGE_TRAIT_SKILL)?.icon || ''
  );
}
