import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { ConditionEffect, StatusEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTriggerPoint } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile, Skill } from '#gw2/platform/skills/types.js';
import {
  beastSkillUsed,
  mergedBeastHit,
  mergedCommandApplied
} from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { setRangerPetActive } from '#gw2/professions/ranger/core/mechanics/pets.js';
import {
  isPlayerStrike,
  rangerProfileEffectRequest
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { triggerMergedPoisonousStrikes } from '#gw2/professions/ranger/core/skills/weapons/dagger.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerPetForState } from '#gw2/professions/ranger/data/pets.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { essenceOfSpeedExtension } from '#gw2/professions/ranger/specializations/soulbeast/traits/behavior.js';
import type {
  RangerResolverContext,
  RangerRuntime,
  RangerRuntimeState,
  RangerSkill
} from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Soulbeast resolver-phase reactions and event handlers. */

export function activeSoulbeastBuff(context: RangerResolverContext, kind: string, at: number): boolean {
  // These personal stance queries cannot borrow a companion's or ally's application.
  return context.combat.activeBuffStacks(kind, at, 1) > 0;
}

// Beast Ability is always the last skill in beastmodeSkillIds; traits like Live Fast and Go for the Eyes
// should fire only on the first hit of a multi-hit Beast Ability, not once per packet.
function firstBeastAbilityHit(context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
  const activePet = rangerPetForState(professionCoreState(context));
  const beastSkillId = activePet.beastmodeSkillIds.at(-1);

  if (event.skillId !== beastSkillId || !event.activationId) return false;

  return claimActivation(
    soulbeastState.from(context).soulbeastActivationClaims,
    'ranger.beast-ability',
    event.activationId
  );
}

/** Personal and allied echoes use the same delayed strike and source attributes. */
function queueOneWolfPackStrike(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  strike: StrikeEffect
): void {
  const hits = effectNumber(profile, strike, 'hits');
  context.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: event.at + balanceProfileNumber(profile, 'initialDelay'),
      source: 'ranger',
      sourceId: ID.ONE_WOLF_PACK_STRIKE,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      skillId: ID.ONE_WOLF_PACK,
      skillName: 'One Wolf Pack',

      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits,

      totalHits: hits,
      // Echoes use the stance's nonweapon strength, independent of the attack that triggered them.
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: event.skillName,
      metadata: event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : undefined
    })
  });
}

/** Vulture's poison is attributed to the stance source; might stays on the triggering recipient. */
function queueVultureStanceEffects(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  poison: ConditionEffect | undefined,
  might: StatusEffect | undefined
): void {
  // Only shared stance output changes source; personal procs retain their trait presentation.
  for (const request of [
    poison && rangerProfileEffectRequest(event, profile, poison, ID.VULTURE_STANCE, 'Vulture Stance'),
    might && rangerProfileEffectRequest(event, profile, might, ID.VULTURE_STANCE, 'Vulture Stance')
  ]) {
    if (request)
      context.effects.emit({
        ...request,
        attribution: {
          ...request.attribution,
          source: event.metadata?.triggeredByAlly ? 'ranger' : 'Trait',
          // Personal and shared stance poison both inherit the Ranger's damage and duration modifiers.
          ownerActorType: ACTOR.PLAYER
        }
      });
  }
}

/**
 * Resolve a stance's surviving output before its cooldown advances; a stance whose packets were all removed has no
 * proc to gate, so it must not consume the cooldown either.
 */
function queueStanceProc(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  wolfPack: boolean,
  startCooldown: (internalCooldown: number) => void
): void {
  if (wolfPack) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.oneWolfPack);
    const strike = requireEffect(profile, 'strike', 'Strike');

    if (!strike) return;

    startCooldown(balanceProfileNumber(profile, 'internalCooldown'));
    queueOneWolfPackStrike(context, event, profile, strike);
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.vultureStance);
  const poison = requireEffect(profile, 'condition', CONDITION.POISONED);
  const might = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  if (!poison && !might) return;

  startCooldown(balanceProfileNumber(profile, 'internalCooldown'));
  queueVultureStanceEffects(context, event, profile, poison, might);
}

/**
 * One cooldown boundary per stance for every recipient. One Wolf Pack admits a strike exactly at its deadline: observed
 * Frost Trap pulses echo at its 1 s cadence, which the strict boundary would halve. Vulture Stance blocks its deadline.
 */
function stanceCooldownReady(wolfPack: boolean, at: number, deadline: number): boolean {
  return wolfPack ? canonicalTime(at) >= canonicalTime(deadline) : isInternalCooldownReady(at, deadline);
}

/** Each ally keeps independent stance cooldowns across overlapping applications, under the player's boundaries. */
export function handleSharedStanceHit(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const allyIndex = event.metadata?.triggeredByAlly;

  if (!allyIndex) return;

  const key = `${event.kind}:${allyIndex}`;
  const wolfPack = event.kind === 'one-wolf-pack';

  if (!stanceCooldownReady(wolfPack, event.at, context.procs.deadline(`ranger.soulbeast.alliedStance:${key}`))) return;

  queueStanceProc(context, event, wolfPack, (internalCooldown) => {
    context.procs.setDeadline(`ranger.soulbeast.alliedStance:${key}`, event.at + internalCooldown);
  });
}

export function reactToSoulbeastDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;

  triggerMergedPoisonousStrikes(context, event);

  // One Wolf Pack must not trigger from its own echo or from effect-sourced hits to avoid infinite recursion.
  if (
    isPlayerStrike(event) &&
    event.sourceId !== ID.ONE_WOLF_PACK_STRIKE &&
    activeSoulbeastBuff(context, 'one-wolf-pack', event.at) &&
    stanceCooldownReady(true, event.at, context.procs.deadline('ranger.soulbeast.oneWolfPack'))
  ) {
    // 1-second ICD between echoes even within a single multi-hit skill.
    queueStanceProc(context, event, true, (internalCooldown) => {
      context.procs.setDeadline('ranger.soulbeast.oneWolfPack', event.at + internalCooldown);
    });
  }

  // Vulture Stance procs per player hit with a 0.25 s ICD; effect-sourced hits (e.g. OWP echoes) are excluded.
  if (
    activeSoulbeastBuff(context, 'vulture-stance', event.at) &&
    stanceCooldownReady(false, event.at, context.procs.deadline('ranger.soulbeast.vultureStance')) &&
    isPlayerStrike(event)
  ) {
    queueStanceProc(context, event, false, (internalCooldown) => {
      context.procs.setDeadline('ranger.soulbeast.vultureStance', event.at + internalCooldown);
    });
  }

  if (!firstBeastAbilityHit(context, event)) return;

  context.fireTrigger(mergedBeastHit, { event });
}

/** Quickness extends existing boons once; shared attacks wait for an actual combat boundary. */
export function reactToSoulbeastBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const extension = essenceOfSpeedExtension(context, event);

  if (extension) context.effects.emit({ kind: 'packet', event: extension });

  scheduleSharedStance(context, event);
}

/** A delayed engagement keeps the original stance expiry. */
function scheduleSharedStance(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // Shared windows use the existing ally attack assumptions and end at half the personal duration.
  if (event.kind !== 'one-wolf-pack' && event.kind !== 'vulture-stance') return;

  const maximumAllies = event.resolvedAudience?.alliedPlayerCount ?? 0;

  if (!maximumAllies) return;

  // Live windows share the global strike cadence; the existing recipient ICD handles overlapping grants.
  context.alliedStrikes.registerRecipients(
    (allyIndex) => ({
      id: `stance:${event.kind}:${event.activationId}:${event.at}:${allyIndex}`,
      expiresAt: event.at + (event.duration || 0),
      inclusiveExpiry: true,
      trigger(proc) {
        handleSharedStanceHit(context, {
          type: 'proc',
          at: proc.at,
          source: 'ranger',
          sourceId: event.sourceId,
          kind: event.kind,
          actorType: ACTOR.EFFECT,
          skillName: `Allied Player ${proc.allyIndex} Attack`,
          activationId: proc.activationId,
          metadata: { triggeredByAlly: proc.allyIndex }
        });
      }
    }),
    { maximumAllies, alliedPlayerIndex: event.resolvedAudience?.alliedPlayerIndex }
  );
}

// Winter's Bite fires once per weapon skill hit via the ranger core flag; the flag is cleared here
// and is reset by the ranger core when a new weapon cycle begins, not on cooldown expiry.
export function reactToRangerWinterBite(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);

  if (
    !core.winterBiteReady ||
    // Guard against the Winter's Bite proc re-triggering itself.
    event.sourceId === ID.WINTERS_BITE ||
    event.actorType === ACTOR.EFFECT
  ) {
    return;
  }

  core.winterBiteReady = false;
  const profile = requireBalanceProfileFromContext(context, PROFILE.wintersBite);
  const weakness = requireEffect(profile, 'condition', CONDITION.WEAKNESS);

  if (weakness)
    context.effects.emit(rangerProfileEffectRequest(event, profile, weakness, ID.WINTERS_BITE, "Winter's Bite"));
}

export function soulbeastCastAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  // Swapping while unmerged changes which pet grants merged skills on reentry.
  const pet = rangerPetForState(professionCoreState(context));

  if (skill.beastmodeSkill && !toggle && !pet.beastmodeSkillIds.includes(skill.id)) {
    return deny(skill, 'ranger.inactive-merged-pet-skill', 'select the pet that grants this merged Beast skill.');
  }

  if (skill.beastmodeSkill && !state.beastmodeActive && skill.id !== ID.BEASTMODE) {
    return deny(skill, 'ranger.beastmode-inactive', 'enter Beastmode first.');
  }

  if (skill.id === ID.BEASTMODE && state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-active', 'Beastmode is already active.');
  }

  if (skill.id === ID.LEAVE_BEASTMODE && !state.beastmodeActive) {
    return deny(skill, 'ranger.beastmode-inactive', 'Beastmode is not active.');
  }

  return { ready: true };
}

/** The selected trait observes this accepted transition before subsequent mechanic work. */
export const beastmodeChanged = defineTriggerPoint<{ readonly skill: RangerSkill }>('ranger.beastmode-changed', [
  TRAIT.UNSTOPPABLE_UNION
]);

/** Keep merge, pet lifetime, and Unstoppable Union in one ordered transition. */
export function setBeastmode(runtime: RangerRuntime, skill: Skill, active: boolean): void {
  soulbeastState.from(runtime).beastmodeActive = active;
  setRangerPetActive(runtime, !active, skill.id);
  runtime.fireTrigger(beastmodeChanged, { skill });
}

/** Merge transitions, pet presence, availability, and merged-command rewards share one Beastmode lifecycle. */
export const beastmodeLifecycle: RuntimeHooks<RangerRuntimeState, RangerSkill> = {
  /** Initialize only damage-relevant form and scaling state for one assumed occurrence. */
  prepareDamageState(runtime, skill, inputs) {
    soulbeastState.from(runtime).beastmodeActive = Boolean(skill?.beastmodeSkill || inputs.merged);
  },
  initialize(runtime) {
    setRangerPetActive(runtime, !soulbeastState.from(runtime).beastmodeActive, ID.BEASTMODE);
  },
  availability: soulbeastCastAvailability,
  onCastCommit(runtime, cast) {
    const state = soulbeastState.from(runtime);
    const skill = cast.skill;

    if (!state.beastmodeActive) return;

    runtime.fireTrigger(mergedCommandApplied, { skill: skill, at: runtime.time });

    if (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
      runtime.fireTrigger(beastSkillUsed, { skill });
  },
  sideEffectHandlers: {
    'ranger.beastmode-enter'(runtime, context) {
      setBeastmode(runtime, context.skill, true);
    },
    'ranger.beastmode-leave'(runtime, context) {
      setBeastmode(runtime, context.skill, false);
    }
  }
};
