import {
  balanceProfileFromContext,
  balanceProfileEffect,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { AvailabilityResult } from '#gw2/platform/engine/types.js';
import { denySkillCast as deny } from '#gw2/content/professions/lib/availability.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { RangerCastContext, RangerPrecastContext, RangerSkill } from '#gw2/content/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/content/professions/ranger/core/state.js';
import { galeshotState } from '#gw2/content/professions/ranger/specializations/galeshot/state.js';
import {
  advanceGaleshotArrows,
  completeGaleshotSkill,
  handleGaleshotDisableTask,
  handleGaleshotMissileHitTask,
  handleGaleshotPetHitTask,
  observeGaleshotEvent
} from '#gw2/content/professions/ranger/specializations/galeshot/mechanics/cyclone-bow.js';

import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/galeshot/profiles.js';

// Grant Cloudburst's profile-defined party boons from the qualifying reset skill
// at cast completion.
function emitCloudburstBoons(context: RangerCastContext, skill: RangerSkill): void {
  if (!hasTrait(context, TRAIT.CLOUDBURST)) return;
  const hawkeye = skill.id === ID.HAWKEYE;
  const profile = balanceProfileFromContext(context, PROFILE.cloudburst);
  for (let boonIndex = 0; boonIndex < 2; boonIndex += 1) {
    const effect = balanceProfileEffect(profile, 'boon', (hawkeye ? 2 : 0) + boonIndex);
    const kind = String(effect?.boon || ['quickness', 'might'][boonIndex]);
    emitSkillBuff(context, {
      at: context.effectiveEnd,
      source: 'Trait',
      sourceId: TRAIT.CLOUDBURST,
      actorType: 'effect',
      skillId: TRAIT.CLOUDBURST,
      skillName: 'Cloudburst',
      name: `Cloudburst - ${kind}`,
      kind,
      boon: kind,
      duration: gw2SchedulerBoonDuration(
        context,
        skill,
        kind,
        Number(effect?.duration ?? (boonIndex === 0 ? (hawkeye ? 8 : 4) : 10))
      ),
      stacks: Number(effect?.stacks ?? (boonIndex === 0 ? 1 : hawkeye ? 8 : 4)),
      recipients: 'party',
      maximumRecipients: 5,
      triggeredBy: skill.name
    });
  }
}

export function applyGaleshotCycloneBowTraits(context: RangerCastContext, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (skill.id === ID.HAWKEYE) {
    if (hasTrait(context, TRAIT.GALE_FORCE)) {
      const effect = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.galeForce), 'buff');
      const duration = Number(effect?.duration ?? 10);
      // galeForceUntil is a timestamp, not a duration; compare against context.time in modifiers.
      state.galeForceUntil = context.effectiveEnd + duration;
      emitSkillBuff(context, {
        at: context.effectiveEnd,
        source: 'Trait',
        sourceId: TRAIT.GALE_FORCE,
        actorType: 'effect',
        skillId: TRAIT.GALE_FORCE,
        skillName: 'Gale Force',
        kind: String(effect?.kind || 'gale-force'),
        duration,
        stacks: Number(effect?.stacks ?? 1),
        triggeredBy: skill.name
      });
    }

    emitCloudburstBoons(context, skill);
    return;
  }

  if (skill.id === ID.BLUSTER) {
    // Wuthering Wind is primed by Bluster; the charge is only consumable at or
    // after effectiveEnd so the same cast can't immediately trigger itself.
    state.wutheringWindReady = hasTrait(context, TRAIT.WUTHERING_WIND);
    state.wutheringWindReadyAt = context.effectiveEnd;
    emitCloudburstBoons(context, skill);
  }

  if (
    hasTrait(context, TRAIT.CLOUDBURST) &&
    [ID.QUARRYS_PERIL, ID.SUPERSONIC_ARROW].includes(skill.id as typeof ID.QUARRYS_PERIL | typeof ID.SUPERSONIC_ARROW)
  ) {
    // Cloudburst trait: these two skills reset Bluster's cooldown on cast.
    context.state.cooldowns.delete(ID.BLUSTER);
  }
}

export const galeshotSchedulerHooks = Object.freeze({
  advance: {
    id: 'ranger.galeshot-arrows',
    order: 20,
    handler: advanceGaleshotArrows
  },
  onCastComplete: {
    id: 'ranger.galeshot-traits',
    order: 20,
    handler: completeGaleshotSkill
  },
  onEventScheduled: {
    id: 'ranger.galeshot-events',
    order: 20,
    handler: observeGaleshotEvent
  },
  taskHandlers: Object.freeze({
    'ranger.galeshot-missile-hit': handleGaleshotMissileHitTask,
    'ranger.galeshot-pet-hit': handleGaleshotPetHitTask,
    'ranger.galeshot-disable': handleGaleshotDisableTask
  })
});

// Gate Galeshot casts by Cyclone Bow ownership, arrows, Wind Force, and the
// Perilous Skies replacement before the shared Ranger checks run.
export function galeshotCastAvailability(context: RangerPrecastContext, skill: RangerSkill): AvailabilityResult {
  const state = galeshotState.from(context);
  if (skill.cycloneBowSkill && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'summon the Cyclone Bow first.');
  }

  if (skill.id === ID.SUMMON_CYCLONE_BOW && state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-active', 'the Cyclone Bow is already active.');
  }

  if (skill.id === ID.DISMISS_CYCLONE_BOW && !state.cycloneBowActive) {
    return deny(skill, 'ranger.cyclone-bow-inactive', 'the Cyclone Bow is not active.');
  }

  if (Number(skill.arrowCost || 0) > state.arrows) {
    return deny(skill, 'ranger.arrows', `requires ${skill.arrowCost} arrows.`);
  }

  const maximumWindForce = balanceProfileValueFromContext(context, PROFILE.resources, 'minimumStacks', 5);
  if (skill.id === ID.HAWKEYE && state.windForce < maximumWindForce) {
    return deny(skill, 'ranger.wind-force', `requires ${maximumWindForce} Wind Force.`);
  }

  if (skill.id === ID.KEEN_SHOT && state.windForce >= maximumWindForce) {
    return deny(skill, 'ranger.hawkeye-ready', 'Hawkeye replaces Keen Shot at 5 Wind Force.');
  }

  if (skill.id === ID.QUARRYS_PERIL && hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(skill, 'ranger.perilous-skies', 'Pelt replaces this skill.');
  }

  if (skill.id === ID.PELT && !hasTrait(context, TRAIT.PERILOUS_SKIES)) {
    return deny(skill, 'ranger.perilous-skies', "select Perilous Skies to replace Quarry's Peril.");
  }

  if (state.cycloneBowActive && skill.type === 'Weapon' && !skill.cycloneBowSkill) {
    return deny(skill, 'ranger.cyclone-bow-weapon-bar', 'the Cyclone Bow replaces weapon skills.');
  }

  return { ready: true };
}

function galeshotRuntimeState(context: Gw2ModifierContext) {
  return readProfessionSpecializationState<{ windForce?: number; galeForceUntil?: number }>(
    context.runtime?.profession,
    'Galeshot'
  );
}

function windForce(context: Gw2ModifierContext): number {
  return Number(galeshotRuntimeState(context)?.windForce || 0);
}

function galeForceAmount(context: Gw2ModifierContext, parameters: Readonly<Record<string, number>>): number {
  const galeForce =
    Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time ? parameters.galeForceBonus : 0;
  // Hawkeye converts the five existing stacks into a 25% flat bonus (galeForce),
  // but Wind Force earned while Gale Force is active still adds 3% per stack on top.
  return galeForce + windForce(context) * parameters.windForcePerStack;
}

function activePetIsFeathered(context: Gw2ModifierContext): boolean {
  const name = String(
    readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
      context.config?.selectedPet ||
      ''
  );
  return ['avian', 'moa', 'phoenix', 'raptor swiftwing'].includes(rangerPetByName(name).family);
}

function eventSkillId(context: Gw2ModifierContext): number {
  return Number(context.event?.skillId ?? context.skillId);
}

// Galeshot player modifiers follow outgoing ownership without changing explicit pet-only branches.
export const galeshotModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.bird-of-prey',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BIRD_OF_PREY) &&
      Boolean(context.config?.boons?.swiftness)
  },
  {
    id: 'ranger.gale-force',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: {
      galeForceBonus: 0.25,
      windForcePerStack: 0.03
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) => galeForceAmount(context, parameters),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.GALE_FORCE) &&
      (Number(galeshotRuntimeState(context)?.galeForceUntil || 0) > context.time || windForce(context) > 0)
  },
  {
    id: 'ranger.flock-together',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) =>
      context.event?.actorType === 'summon' &&
      context.event?.source === 'ranger-pet' &&
      hasTrait(context, TRAIT.FLOCK_TOGETHER) &&
      activePetIsFeathered(context)
  },
  {
    id: 'ranger.piercing-gales-vulnerability',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    // Piercing Gales applies its own doubled vulnerability multiplier (2% per
    // stack) in addition to the standard vulnerability already baked into the
    // platform strikeMultiplier, effectively tripling the vulnerability bonus
    // for this skill.
    parameters: {
      baseFactor: 1,
      vulnerabilityPerStack: 0.02
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime || undefined) || 0) *
        parameters.vulnerabilityPerStack,
    when: (context) => eventSkillId(context) === ID.PIERCING_GALES
  }
]);

export const galeshotAttributeRules = Object.freeze({
  modifierRules: galeshotModifierRules
});
export const galeshotCastRules = Object.freeze({
  availability: {
    id: 'ranger.galeshot-availability',
    order: 20,
    handler: galeshotCastAvailability
  }
});
