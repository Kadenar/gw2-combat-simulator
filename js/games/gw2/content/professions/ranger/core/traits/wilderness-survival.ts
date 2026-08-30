/** Owns Core Ranger Wilderness Survival condition and control-triggered trait behavior. */
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GW2_STANDARD_BOONS, isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/integrations/patches/authoring/module-types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import { rangerPetCompanionId } from '#gw2/content/professions/ranger/core/mechanics/pets.js';
import {
  eventSkill,
  isPetStrike,
  isPlayerStrike,
  petDerivedConditionMetadata,
  queueBleeding,
  queueCondition,
  targetHealthFraction
} from '#gw2/content/professions/ranger/core/mechanics/resolution-helpers.js';
import type {
  RangerCastContext,
  RangerResolverContext,
  RangerResolverEvent,
  RangerSchedulerContext,
  RangerSkill
} from '#gw2/content/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/content/professions/ranger/core/state.js';
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  rangerBalanceValue,
  RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE
} from '#gw2/content/professions/ranger/core/profiles.js';

function profileEffect(context: unknown, id: number | string, type: string, index = 0) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, id), type, index);
}

// On an eligible heal, consume Child of Earth's ICD and emit the initial
// immobilize followed by the profile-defined Muddy Terrain condition pulses.
export function emitChildOfEarth(context: RangerCastContext, skill: RangerSkill): void {
  const state = professionCoreState(context);
  const profile = rangerBalanceProfile(context, PROFILE.childOfEarth);
  if (!hasTrait(context, TRAIT.CHILD_OF_EARTH) || !isInternalCooldownReady(context.start, state.childOfEarthReadyAt)) {
    return;
  }

  state.childOfEarthReadyAt = context.start + Number(profile?.internalCooldown ?? 20);
  const at = context.effectiveEnd;
  const immobilized = rangerBalanceProfileEffect(profile, 'condition', 0);
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.CHILD_OF_EARTH,
    actorType: 'effect',
    skillId: TRAIT.CHILD_OF_EARTH,
    skillName: 'Child of Earth',
    name: 'Lesser Muddy Terrain - Immobilized',
    condition: 'Immobilized',
    duration: Number(immobilized?.duration ?? 1),
    stacks: Number(immobilized?.stacks ?? 1),
    triggeredBy: skill.name
  });
  const applications = Number(profile?.maximumStacks ?? 5);
  const interval = Number(profile?.pulseInterval ?? 2);
  for (let application = 0; application < applications; application += 1) {
    for (const effect of [
      rangerBalanceProfileEffect(profile, 'condition', 1),
      rangerBalanceProfileEffect(profile, 'condition', 2)
    ]) {
      const condition = String(effect?.condition || '');
      if (!condition) continue;
      emitSkillCondition(context, {
        at: at + application * interval,
        source: 'Trait',
        sourceId: TRAIT.CHILD_OF_EARTH,
        actorType: 'effect',
        skillId: TRAIT.CHILD_OF_EARTH,
        skillName: 'Child of Earth',
        name: `Lesser Muddy Terrain - ${condition}`,
        condition,
        duration: Number(effect?.duration ?? 0),
        stacks: Number(effect?.stacks ?? 1),
        triggeredBy: skill.name
      });
    }
  }
}

export function triggerPoisonMaster(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  if (!state.poisonMasterPetAttackReady || !isPetStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  state.poisonMasterPetAttackReady = false;
  const poison = profileEffect(context, PROFILE.poisonMaster, 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.POISON_MASTER,
    actorType: 'effect',
    skillId: TRAIT.POISON_MASTER,
    skillName: 'Poison Master',
    name: 'Poison Master - Poisoned',
    condition: 'Poisoned',
    duration: Number(poison?.duration ?? 8),
    stacks: Number(poison?.stacks ?? 2),
    triggeredBy: event.skillName
  });
}

export function triggerArachnophobia(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (
    !isPetStrike(event) ||
    !hasTrait(context, TRAIT.ARACHNOPHOBIA) ||
    (event.skillId !== ID.SPIT && event.skillId !== ID.TWIN_DARTS)
  ) {
    return;
  }

  const torment = profileEffect(context, PROFILE.arachnophobia, 'condition');
  queueCondition(
    context,
    event,
    String(torment?.condition || 'Torment'),
    Number(torment?.duration ?? 3),
    Number(torment?.stacks ?? 1),
    TRAIT.ARACHNOPHOBIA,
    'Arachnophobia'
  );
}

// Record the target-control window and dispatch Ranger traits that react to
// canonical control events without replaying the source effect.
export function reactToRangerCoreControl(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = professionCoreState(context);
  if (
    !hasTrait(context, TRAIT.CARNIVORE) ||
    (!isPlayerStrike(event) && !isPetStrike(event)) ||
    !isInternalCooldownReady(event.at, state.carnivoreReadyAt)
  ) {
    return;
  }

  const profile = rangerBalanceProfile(context, PROFILE.carnivore);
  const strike = rangerBalanceProfileEffect(profile, 'strike');
  state.carnivoreReadyAt = event.at + Number(profile?.internalCooldown ?? 0.25);
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.CARNIVORE,
    actorType: 'effect',
    skillId: TRAIT.CARNIVORE,
    skillName: 'Carnivore',
    name: 'Carnivore',
    coefficient: Number(strike?.coefficient ?? 0.05),
    hits: Number(strike?.hits ?? 1),
    hitIndex: 1,
    totalHits: Number(strike?.hits ?? 1),
    skillWeapon: 'Unequipped',
    canCrit: false,
    damageKind: 'life-steal',
    triggeredBy: event.skillName
  });
}
