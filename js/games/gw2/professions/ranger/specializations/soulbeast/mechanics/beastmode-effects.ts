import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverBuff, buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { consumeCharge, expireCharges } from '#gw2/platform/combat/resources/charges.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/** Soulbeast resolver-phase reactions and event handlers. */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { BalanceProfile, ConditionEffect, StatusEffect, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import { applyBoonExtension } from '#gw2/platform/combat/boons.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerSchedulerContext } from '#gw2/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { grantMaulAttackOfOpportunity } from '#gw2/professions/ranger/core/mechanics/greatsword.js';

function handleSoulbeastModeEvent(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  soulbeastState.from(context).beastmodeActive = event.active === true;
}

// Retain the legacy event handler while sharing chronological, self-only extension semantics.
export function handleRangerBoonExtension(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  applyBoonExtension(context.boons, event);
}

export const soulbeastEventHandlers = Object.freeze({
  'ranger.shared-stance-hit': handleSharedStanceHit,
  'ranger.beastmode': handleSoulbeastModeEvent,
  'ranger.boon-extension': handleRangerBoonExtension
});

export function activeSoulbeastBuff(context: RangerResolverContext, kind: string, at: number): boolean {
  // These personal stance queries cannot borrow a companion's or ally's application.
  return (context.boons.get(kind) || []).some(
    (application: Gw2TimedBuffApplication) =>
      application.resolvedAudience.includesSelf &&
      application.at <= at &&
      application.expiresAt > at &&
      application.stacks > 0
  );
}

/** Fresh standard boons use live duration scaling; personal stance buffs retain their authored duration. */
export function queueSoulbeastBuff(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  name: string,
  sourceId: number
): void {
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,
      kind,
      duration,
      stacks,
      triggeredBy: event.skillName,
      audience: event.metadata?.triggeredByAlly
        ? {
            recipients: 'party',
            alliedPlayerIndex: event.metadata.triggeredByAlly,
            affectsSelf: false,
            maximumRecipients: 1,
            eligibleCompanionIds: []
          }
        : undefined,
      metadata: event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : undefined
    })
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

/** Emit one surviving profile condition with its authored identity, stacks, and duration. */
function queueProfileCondition(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: ConditionEffect,
  sourceId: number,
  name: string
): void {
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,

      condition: String(effect.condition),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      triggeredBy: event.skillName,
      metadata: event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : undefined
    })
  );
}

/** Emit one surviving boon or buff; its identity comes from the authored boon or buff kind. */
function queueProfileBuff(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  effect: StatusEffect,
  name: string,
  sourceId: number
): void {
  queueSoulbeastBuff(
    context,
    event,
    String(effect.boon ?? effect.kind),
    effectNumber(profile, effect, 'duration'),
    effectNumber(profile, effect, 'stacks'),
    name,
    sourceId
  );
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
  context.queue.enqueue(
    buildResolverCondition({
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
  context.queue.enqueue(
    buildResolverStrike({
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
  );
}

/** Vulture's poison is attributed to the stance source; might stays on the triggering recipient. */
function queueVultureStanceEffects(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  profile: BalanceProfile,
  poison: ConditionEffect | undefined,
  might: StatusEffect | undefined
): void {
  if (poison) queueProfileCondition(context, event, profile, poison, ID.VULTURE_STANCE, 'Vulture Stance');
  if (might) queueProfileBuff(context, event, profile, might, 'Vulture Stance', ID.VULTURE_STANCE);
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

/** Allied opportunities have independent stance cooldowns, including across overlapping applications. */
function handleSharedStanceHit(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const allyIndex = event.metadata?.triggeredByAlly;
  if (!allyIndex) return;
  const key = `${event.kind}:${allyIndex}`;
  const state = soulbeastState.from(context);
  if (event.at + EPSILON < (state.alliedStanceReadyAt[key] ?? 0)) return;
  queueStanceProc(context, event, event.kind === 'one-wolf-pack', (internalCooldown) => {
    state.alliedStanceReadyAt[key] = event.at + internalCooldown;
  });
}

export function reactToSoulbeastDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = soulbeastState.from(context);
  // Merged Maul grants the player the smaller next-attack bonus in place of the pet's bonus.
  if (state.beastmodeActive) grantMaulAttackOfOpportunity(context, event, 'player');
  triggerMergedPoisonousStrikes(context, event);

  // One Wolf Pack must not trigger from its own echo or from effect-sourced hits to avoid infinite recursion.
  if (
    isPlayerStrike(event) &&
    event.sourceId !== ID.ONE_WOLF_PACK_STRIKE &&
    activeSoulbeastBuff(context, 'one-wolf-pack', event.at) &&
    // Periodic hits exactly one interval apart can each trigger an echo; tolerate floating-point drift.
    event.at + EPSILON >= state.oneWolfPackReadyAt
  ) {
    // 1-second ICD between echoes even within a single multi-hit skill.
    queueStanceProc(context, event, true, (internalCooldown) => {
      state.oneWolfPackReadyAt = event.at + internalCooldown;
    });
  }

  // Vulture Stance procs per player hit with a 0.25 s ICD; effect-sourced hits (e.g. OWP echoes) are excluded.
  if (
    activeSoulbeastBuff(context, 'vulture-stance', event.at) &&
    isInternalCooldownReady(event.at, state.vultureStanceReadyAt) &&
    isPlayerStrike(event)
  ) {
    queueStanceProc(context, event, false, (internalCooldown) => {
      state.vultureStanceReadyAt = event.at + internalCooldown;
    });
  }

  if (!firstBeastAbilityHit(context, event)) return;
  if (hasTrait(context, TRAIT.LIVE_FAST)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.liveFast);
    const fury = requireEffect(profile, 'boon', 'fury');
    const quickness = requireEffect(profile, 'boon', 'quickness');
    if (fury) queueProfileBuff(context, event, profile, fury, 'Live Fast', TRAIT.LIVE_FAST);
    if (quickness) queueProfileBuff(context, event, profile, quickness, 'Live Fast', TRAIT.LIVE_FAST);
  }

  if (hasTrait(context, TRAIT.WILTING_STRIKE)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.wiltingStrike);
    const weakness = requireEffect(profile, 'condition', 'Weakness');
    if (weakness) queueProfileCondition(context, event, profile, weakness, TRAIT.WILTING_STRIKE, 'Wilting Strike');
  }

  if (hasTrait(context, TRAIT.GO_FOR_THE_EYES) && isInternalCooldownReady(event.at, state.goForTheEyesReadyAt)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.goForTheEyes);
    const blind = requireEffect(profile, 'blind', 'Blind');
    // The cooldown gates only the blind, so a removed blind leaves it ready.
    if (blind) {
      state.goForTheEyesReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
      context.queue.enqueue({
        type: 'blind',
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.GO_FOR_THE_EYES,
        actorType: 'effect',
        skillId: TRAIT.GO_FOR_THE_EYES,
        skillName: 'Go for the Eyes',
        duration: effectNumber(profile, blind, 'duration'),
        triggeredBy: event.skillName
      });
    }
  }

  if (hasTrait(context, TRAIT.GO_FOR_THE_THROAT) && isInternalCooldownReady(event.at, state.goForTheThroatReadyAt)) {
    const profile = requireBalanceProfileFromContext(context, CORE_PROFILE.goForTheThroat);
    // Merged Soulbeasts receive only the player's buff; the pet variant has no recipient here.
    const lesserSicEm = requireEffect(profile, 'buff', 'lesser-sic-em');
    if (lesserSicEm) {
      state.goForTheThroatReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
      const duration = effectNumber(profile, lesserSicEm, 'duration');
      context.recordProc(
        'trait',
        'Lesser "Sic \'Em!"',
        event.at,
        event.skillName,
        `${duration}s, +15% strike damage`,
        context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon ||
          context.helpers.skillsById?.get(ID.SIC_EM)?.icon ||
          ''
      );
      queueProfileBuff(context, event, profile, lesserSicEm, 'Lesser "Sic \'Em!"', ID.LESSER_SIC_EM);
    }
  }
}

// Translate canonical control into Soulbeast trait reactions after the control
// window has been accepted by the core resolver.
export function reactToSoulbeastControl(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = soulbeastState.from(context);
  if (hasTrait(context, TRAIT.TWICE_AS_VICIOUS)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.twiceAsVicious);
    const buff = requireEffect(profile, 'buff', 'twice-as-vicious');
    if (buff) queueProfileBuff(context, event, profile, buff, 'Twice as Vicious', TRAIT.TWICE_AS_VICIOUS);
  }

  if (hasTrait(context, TRAIT.BESTIAL_RAGE) && isInternalCooldownReady(event.at, state.bestialRageReadyAt)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.bestialRage);
    const might = requireEffect(profile, 'boon', 'might');
    const fury = requireEffect(profile, 'boon', 'fury');
    // Either surviving boon keeps the shared cooldown; removing both leaves no proc to gate.
    if (might || fury) state.bestialRageReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
    if (might) queueProfileBuff(context, event, profile, might, 'Bestial Rage', TRAIT.BESTIAL_RAGE);
    if (fury) queueProfileBuff(context, event, profile, fury, 'Bestial Rage', TRAIT.BESTIAL_RAGE);
  }
}

// Predator's Cunning triggers a flat-coefficient strike on every Poisoned application, not once per tick.
export function reactToSoulbeastCondition(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (event.condition !== 'Poisoned' || !hasTrait(context, TRAIT.PREDATORS_CUNNING)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.predatorsCunning);
  const strike = requireEffect(profile, 'strike', 'Strike');
  if (!strike) return;
  const hits = effectNumber(profile, strike, 'hits');
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.PREDATORS_CUNNING,
      actorType: 'effect',
      skillId: TRAIT.PREDATORS_CUNNING,
      skillName: "Predator's Cunning",

      coefficient: effectNumber(profile, strike, 'coefficient'),
      hits,

      totalHits: hits,
      skillWeapon: 'Unequipped',
      canCrit: false,
      triggeredBy: event.skillName
    })
  );
}

// Essence of Speed reacts to each quickness application and extends all other boons by 2 s, with a 5 s ICD.
// Quickness itself is excluded from the extension to prevent runaway stacking.
export function essenceOfSpeedExtension(
  context: RangerResolverContext | RangerSchedulerContext,
  event: Gw2ResolverEvent
): Gw2ResolverEvent | null {
  const state = soulbeastState.from(context);
  if (
    event.kind !== 'quickness' ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !isInternalCooldownReady(event.at, state.essenceOfSpeedReadyAt)
  ) {
    return null;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.essenceOfSpeed);
  state.essenceOfSpeedReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
  return {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: 'effect',
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: 'Essence of Speed',
    duration: balanceProfileNumber(profile, 'durationMultiplier'),
    excludedKind: 'quickness'
  };
}

/** Resolver-derived Quickness retains its own extension; scheduled predictions are discarded at handoff. */
export function reactToSoulbeastBuff(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const extension = essenceOfSpeedExtension(context, event);
  if (extension) context.queue.enqueue(extension);

  // Shared windows use the existing ally attack assumptions and end at half the personal duration.
  if (event.kind !== 'one-wolf-pack' && event.kind !== 'vulture-stance') return;
  const maximumAllies = event.resolvedAudience?.alliedPlayerCount ?? 0;
  if (!maximumAllies) return;
  const profile = requireBalanceProfileFromContext(
    context,
    event.kind === 'one-wolf-pack' ? PROFILE.oneWolfPack : PROFILE.vultureStance
  );
  // Allies begin attacking in combat; waiting to engage never extends the shared stance's expiry.
  const start = Math.max(event.at, context.combatStartTime ?? event.at);
  for (const proc of gw2AlliedPlayerProcTimeline(context.config, {
    start,
    duration: Math.max(0, event.at + Number(event.duration || 0) - start),
    maximumAllies,
    internalCooldown: balanceProfileNumber(profile, 'internalCooldown')
  })) {
    context.queue.enqueue({
      type: 'ranger.shared-stance-hit',
      at: proc.at,
      source: 'ranger',
      sourceId: event.sourceId,
      kind: event.kind,
      actorType: 'effect',
      skillName: `Allied Player ${proc.allyIndex} Attack`,
      metadata: { triggeredByAlly: proc.allyIndex }
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
  if (weakness) queueProfileCondition(context, event, profile, weakness, ID.WINTERS_BITE, "Winter's Bite");
}
