import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { consumeCharge, expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { denySkillCast as deny } from '#gw2/platform/execution/availability.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { StatusEffect } from '#gw2/platform/effects/types.js';
import type { ConditionEffect, StrikeEffect } from '#gw2/platform/effects/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  isPlayerStrike,
  rangerBuffRequest,
  rangerConditionRequest
} from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  triggerMergedGoForTheEyes,
  triggerMergedGoForTheThroat,
  triggerMergedWiltingStrike
} from '#gw2/professions/ranger/core/traits/pet-behavior.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import {
  essenceOfSpeedExtension,
  triggerMergedLiveFast
} from '#gw2/professions/ranger/specializations/soulbeast/traits/behavior.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';

/** Soulbeast resolver-phase reactions and event handlers. */

/** Shared stance opportunities resolve against the one live stance cooldown. */
export const soulbeastEventHandlers = Object.freeze({ 'ranger.shared-stance-hit': handleSharedStanceHit });

export function activeSoulbeastBuff(context: RangerResolverContext, kind: string, at: number): boolean {
  // These personal stance queries cannot borrow a companion's or ally's application.
  return context.combat
    .boonApplications(kind)
    .some(
      (application: Gw2TimedBuffApplication) =>
        application.resolvedAudience.includesSelf &&
        application.at <= at &&
        application.expiresAt > at &&
        application.stacks > 0
    );
}

// Beast Ability is always the last skill in beastmodeSkillIds; traits like Live Fast and Go for the Eyes
// should fire only on the first hit of a multi-hit Beast Ability, not once per packet.
function firstBeastAbilityHit(context: RangerResolverContext, event: Gw2ResolverEvent): boolean {
  const activePet = rangerPetByName(professionCoreState(context).activePet);
  const beastSkillId = activePet.beastmodeSkillIds.at(-1);
  if (event.skillId !== beastSkillId || !event.activationId) return false;
  const activations = soulbeastState.from(context).beastAbilityActivations;
  if (activations[event.activationId]) return false;
  activations[event.activationId] = true;
  return true;
}

/** Consumes Poisonous Strikes from player hits only while Soulbeast replaces its pet in Beastmode. */
function triggerMergedPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  expireCharges(core.poisonousStrikes, event.at, true);
  if (!soulbeastState.from(context).beastmodeActive || !isPlayerStrike(event) || !(Number(event.coefficient) > 0)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, CORE_PROFILE.poisonousStrikes);
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  // The charges exist only to deliver poison, so a removed packet leaves them unspent.
  if (!poison || !consumeCharge(core.poisonousStrikes, event.at, 0, true)) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: event.at,
      source: 'ranger',
      sourceId: ID.DOUBLE_ARC,
      actorType: 'effect',
      skillId: ID.DOUBLE_ARC,
      skillName: 'Poisonous Strikes',
      name: 'Poisonous Strikes - Poisoned',
      condition: String(poison.condition),
      duration: effectNumber(profile, poison, 'duration'),
      stacks: effectNumber(profile, poison, 'stacks'),
      triggeredBy: event.skillName
    })
  });
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
      actorType: 'effect',
      ownerActorType: 'player',
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
  if (poison) context.effects.emit(rangerConditionRequest(event, profile, poison, ID.VULTURE_STANCE, 'Vulture Stance'));
  if (might) context.effects.emit(rangerBuffRequest(event, profile, might, 'Vulture Stance', ID.VULTURE_STANCE));
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
  const poison = requireEffect(profile, 'condition', 'Poisoned');
  const might = requireEffect(profile, 'boon', 'might');
  if (!poison && !might) return;
  startCooldown(balanceProfileNumber(profile, 'internalCooldown'));
  queueVultureStanceEffects(context, event, profile, poison, might);
}

/** Allied stance cooldowns block their exact deadline independently, including across overlapping applications. */
function handleSharedStanceHit(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const allyIndex = event.metadata?.triggeredByAlly;
  if (!allyIndex) return;
  const key = `${event.kind}:${allyIndex}`;
  if (!isInternalCooldownReady(event.at, context.procs.deadline(`ranger.soulbeast.alliedStance:${key}`))) return;
  queueStanceProc(context, event, event.kind === 'one-wolf-pack', (internalCooldown) => {
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
    // Personal One Wolf Pack intentionally includes its 1s deadline: observed Frost Trap pulses each echo at 1s cadence.
    // The shared strict ICD helper would skip alternate pulses; canonical times avoid needing an epsilon here.
    canonicalTime(event.at) >= canonicalTime(context.procs.deadline('ranger.soulbeast.oneWolfPack'))
  ) {
    // 1-second ICD between echoes even within a single multi-hit skill.
    queueStanceProc(context, event, true, (internalCooldown) => {
      context.procs.setDeadline('ranger.soulbeast.oneWolfPack', event.at + internalCooldown);
    });
  }

  // Vulture Stance procs per player hit with a 0.25 s ICD; effect-sourced hits (e.g. OWP echoes) are excluded.
  if (
    activeSoulbeastBuff(context, 'vulture-stance', event.at) &&
    isInternalCooldownReady(event.at, context.procs.deadline('ranger.soulbeast.vultureStance')) &&
    isPlayerStrike(event)
  ) {
    queueStanceProc(context, event, false, (internalCooldown) => {
      context.procs.setDeadline('ranger.soulbeast.vultureStance', event.at + internalCooldown);
    });
  }

  if (!firstBeastAbilityHit(context, event)) return;
  triggerMergedLiveFast(context, event);
  triggerMergedWiltingStrike(context, event);
  triggerMergedGoForTheEyes(context, event);
  triggerMergedGoForTheThroat(context, event);
}

/** Quickness extends existing boons once; shared attacks wait for an actual combat boundary. */
export function reactToSoulbeastBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const extension = essenceOfSpeedExtension(context, event);
  if (extension) context.effects.emit({ kind: 'packet', event: extension });
  if (context.combatStartPending) {
    if (event.kind === 'one-wolf-pack' || event.kind === 'vulture-stance')
      soulbeastState.from(context).pendingSharedStances.push(event);
    return;
  }

  scheduleSharedStance(context, event);
}

/** A delayed engagement keeps the original stance expiry. */
export function scheduleSharedStance(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  // Shared windows use the existing ally attack assumptions and end at half the personal duration.
  if (event.kind !== 'one-wolf-pack' && event.kind !== 'vulture-stance') return;
  const maximumAllies = event.resolvedAudience?.alliedPlayerCount ?? 0;
  if (!maximumAllies) return;
  // Allies begin attacking in combat; waiting to engage never extends the shared stance's expiry.
  // Keep every attack opportunity so the strict stance gate, rather than a prefiltered cadence, decides procs.
  const start = Math.max(event.at, context.combatStartTime ?? event.at);
  for (const proc of gw2AlliedPlayerProcTimeline(context.config, {
    start,
    duration: Math.max(0, event.at + (event.duration || 0) - start),
    maximumAllies
  })) {
    context.effects.emit({
      kind: 'packet',
      event: {
        type: 'ranger.shared-stance-hit',
        at: proc.at,
        source: 'ranger',
        sourceId: event.sourceId,
        kind: event.kind,
        actorType: 'effect',
        skillName: `Allied Player ${proc.allyIndex} Attack`,
        metadata: { triggeredByAlly: proc.allyIndex }
      }
    });
  }
}

// Winter's Bite fires once per weapon skill hit via the ranger core flag; the flag is cleared here
// and is reset by the ranger core when a new weapon cycle begins, not on cooldown expiry.
export function reactToRangerWinterBite(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  if (
    !core.winterBiteReady ||
    // Guard against the Winter's Bite proc re-triggering itself.
    event.sourceId === ID.WINTERS_BITE ||
    event.actorType === 'effect'
  ) {
    return;
  }

  core.winterBiteReady = false;
  const profile = requireBalanceProfileFromContext(context, PROFILE.wintersBite);
  const weakness = requireEffect(profile, 'condition', 'Weakness');
  if (weakness)
    context.effects.emit(rangerConditionRequest(event, profile, weakness, ID.WINTERS_BITE, "Winter's Bite"));
}

export function soulbeastCastAvailability(
  context: MechanicQueriesOf<RangerRuntime>,
  skill: RangerSkill
): AvailabilityResult {
  const state = soulbeastState.from(context);
  const toggle = skill.id === ID.BEASTMODE || skill.id === ID.LEAVE_BEASTMODE;
  // Swapping while unmerged changes which pet grants merged skills on reentry.
  const pet = rangerPetByName(professionCoreState(context).activePet);
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
