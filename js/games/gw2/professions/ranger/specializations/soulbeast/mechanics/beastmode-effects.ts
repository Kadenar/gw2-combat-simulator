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
  balanceProfileEffectFromContext as profileEffect,
  balanceProfileFromContext,
  balanceProfileEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
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

export function handleSoulbeastModeEvent(context: RangerResolverContext, event: Gw2ResolverEvent): void {
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

/** Preserve the selected profile's condition stack count as well as its duration. */
function queueCondition(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  condition: string,
  duration: number,
  sourceId: number,
  name: string,
  stacks: number
): void {
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      skillId: sourceId,
      skillName: name,

      condition,
      duration,
      stacks,
      triggeredBy: event.skillName,
      metadata: event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : undefined
    })
  );
}

/** Consumes Poisonous Strikes from player hits only while Soulbeast replaces its pet in Beastmode. */
function triggerMergedPoisonousStrikes(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  expireCharges(core.poisonousStrikes, event.at, true);
  if (
    !soulbeastState.from(context).beastmodeActive ||
    !isPlayerStrike(event) ||
    !(Number(event.coefficient) > 0) ||
    !consumeCharge(core.poisonousStrikes, event.at, 0, true)
  ) {
    return;
  }

  const poison = profileEffect(context, CORE_PROFILE.poisonousStrikes, 'condition');
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'ranger',
      sourceId: ID.DOUBLE_ARC,
      actorType: 'effect',
      skillId: ID.DOUBLE_ARC,
      skillName: 'Poisonous Strikes',
      name: 'Poisonous Strikes - Poisoned',
      condition: 'Poisoned',
      duration: Number(poison?.duration ?? 6),
      stacks: Number(poison?.stacks ?? 1),
      triggeredBy: event.skillName
    })
  );
}

/** Personal and allied echoes use the same delayed strike and source attributes. */
function queueOneWolfPackStrike(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const profile = balanceProfileFromContext(context, PROFILE.oneWolfPack);
  const strike = balanceProfileEffect(profile, 'strike');
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at + Number(profile?.initialDelay ?? 0.28),
      source: 'ranger',
      sourceId: ID.ONE_WOLF_PACK_STRIKE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: ID.ONE_WOLF_PACK,
      skillName: 'One Wolf Pack',

      coefficient: Number(strike?.coefficient ?? 0.95),
      hits: Number(strike?.hits ?? 1),

      totalHits: Number(strike?.hits ?? 1),
      // Echoes use the stance's nonweapon strength, independent of the attack that triggered them.
      skillWeapon: 'Unequipped',
      canCrit: true,
      triggeredBy: event.skillName,
      metadata: event.metadata?.triggeredByAlly ? { triggeredByAlly: event.metadata.triggeredByAlly } : undefined
    })
  );
}

/** Vulture's poison is attributed to the stance source; might stays on the triggering recipient. */
function queueVultureStanceEffects(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const profile = balanceProfileFromContext(context, PROFILE.vultureStance);
  const poison = balanceProfileEffect(profile, 'condition');
  const might = balanceProfileEffect(profile, 'boon');
  queueCondition(
    context,
    event,
    String(poison?.condition || 'Poisoned'),
    Number(poison?.duration ?? 4),
    ID.VULTURE_STANCE,
    'Vulture Stance',
    Number(poison?.stacks ?? 1)
  );
  queueSoulbeastBuff(
    context,
    event,
    String(might?.boon || 'might'),
    Number(might?.duration ?? 4),
    Number(might?.stacks ?? 1),
    'Vulture Stance',
    ID.VULTURE_STANCE
  );
}

/** Allied opportunities have independent stance cooldowns, including across overlapping applications. */
function handleSharedStanceHit(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const allyIndex = event.metadata?.triggeredByAlly;
  if (!allyIndex) return;
  const key = `${event.kind}:${allyIndex}`;
  const state = soulbeastState.from(context);
  if (event.at + EPSILON < (state.alliedStanceReadyAt[key] ?? 0)) return;
  const wolfPack = event.kind === 'one-wolf-pack';
  const profile = balanceProfileFromContext(context, wolfPack ? PROFILE.oneWolfPack : PROFILE.vultureStance);
  state.alliedStanceReadyAt[key] = event.at + Number(profile?.internalCooldown ?? (wolfPack ? 1 : 0.25));
  if (wolfPack) queueOneWolfPackStrike(context, event);
  else queueVultureStanceEffects(context, event);
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
    const profile = balanceProfileFromContext(context, PROFILE.oneWolfPack);
    // 1-second ICD between echoes even within a single multi-hit skill.
    state.oneWolfPackReadyAt = event.at + Number(profile?.internalCooldown ?? 1);
    queueOneWolfPackStrike(context, event);
  }

  // Vulture Stance procs per player hit with a 0.25 s ICD; effect-sourced hits (e.g. OWP echoes) are excluded.
  if (
    activeSoulbeastBuff(context, 'vulture-stance', event.at) &&
    isInternalCooldownReady(event.at, state.vultureStanceReadyAt) &&
    isPlayerStrike(event)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.vultureStance);
    state.vultureStanceReadyAt = event.at + Number(profile?.internalCooldown ?? 0.25);
    queueVultureStanceEffects(context, event);
  }

  if (!firstBeastAbilityHit(context, event)) return;
  if (hasTrait(context, TRAIT.LIVE_FAST)) {
    const fury = profileEffect(context, PROFILE.liveFast, 'boon', 0);
    const quickness = profileEffect(context, PROFILE.liveFast, 'boon', 1);
    queueSoulbeastBuff(
      context,
      event,
      String(fury?.boon || 'fury'),
      Number(fury?.duration ?? 6),
      Number(fury?.stacks ?? 1),
      'Live Fast',
      TRAIT.LIVE_FAST
    );
    queueSoulbeastBuff(
      context,
      event,
      String(quickness?.boon || 'quickness'),
      Number(quickness?.duration ?? 3),
      Number(quickness?.stacks ?? 1),
      'Live Fast',
      TRAIT.LIVE_FAST
    );
  }

  if (hasTrait(context, TRAIT.WILTING_STRIKE)) {
    const weakness = profileEffect(context, PROFILE.wiltingStrike, 'condition');
    queueCondition(
      context,
      event,
      String(weakness?.condition || 'Weakness'),
      Number(weakness?.duration ?? 4),
      TRAIT.WILTING_STRIKE,
      'Wilting Strike',
      Number(weakness?.stacks ?? 1)
    );
  }

  if (hasTrait(context, TRAIT.GO_FOR_THE_EYES) && isInternalCooldownReady(event.at, state.goForTheEyesReadyAt)) {
    const profile = balanceProfileFromContext(context, PROFILE.goForTheEyes);
    const blind = balanceProfileEffect(profile, 'blind');
    state.goForTheEyesReadyAt = event.at + Number(profile?.internalCooldown ?? 12);
    context.queue.enqueue({
      type: 'blind',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.GO_FOR_THE_EYES,
      actorType: 'effect',
      skillId: TRAIT.GO_FOR_THE_EYES,
      skillName: 'Go for the Eyes',
      duration: Number(blind?.duration ?? 5),
      triggeredBy: event.skillName
    });
  }

  if (hasTrait(context, TRAIT.GO_FOR_THE_THROAT) && isInternalCooldownReady(event.at, state.goForTheThroatReadyAt)) {
    const profile = balanceProfileFromContext(context, CORE_PROFILE.goForTheThroat);
    const lesserSicEm = balanceProfileEffect(profile, 'buff', 1);
    state.goForTheThroatReadyAt = event.at + Number(profile?.internalCooldown ?? 10);
    const duration = Number(lesserSicEm?.duration ?? 5);
    context.recordProc(
      'trait',
      'Lesser "Sic \'Em!"',
      event.at,
      event.skillName,
      `${duration}s, +15% strike damage`,
      context.helpers.skillsById?.get(ID.LESSER_SIC_EM)?.icon || context.helpers.skillsById?.get(ID.SIC_EM)?.icon || ''
    );
    queueSoulbeastBuff(
      context,
      event,
      String(lesserSicEm?.kind || 'lesser-sic-em'),
      duration,
      Number(lesserSicEm?.stacks ?? 1),
      'Lesser "Sic \'Em!"',
      ID.LESSER_SIC_EM
    );
  }
}

// Translate canonical control into Soulbeast trait reactions after the control
// window has been accepted by the core resolver.
export function reactToSoulbeastControl(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = soulbeastState.from(context);
  if (hasTrait(context, TRAIT.TWICE_AS_VICIOUS)) {
    const buff = profileEffect(context, PROFILE.twiceAsVicious, 'buff');
    queueSoulbeastBuff(
      context,
      event,
      String(buff?.kind || 'twice-as-vicious'),
      Number(buff?.duration ?? 10),
      Number(buff?.stacks ?? 1),
      'Twice as Vicious',
      TRAIT.TWICE_AS_VICIOUS
    );
  }

  if (hasTrait(context, TRAIT.BESTIAL_RAGE) && isInternalCooldownReady(event.at, state.bestialRageReadyAt)) {
    const profile = balanceProfileFromContext(context, PROFILE.bestialRage);
    const might = balanceProfileEffect(profile, 'boon', 0);
    const fury = balanceProfileEffect(profile, 'boon', 1);
    state.bestialRageReadyAt = event.at + Number(profile?.internalCooldown ?? 0.25);
    queueSoulbeastBuff(
      context,
      event,
      String(might?.boon || 'might'),
      Number(might?.duration ?? 8),
      Number(might?.stacks ?? 5),
      'Bestial Rage',
      TRAIT.BESTIAL_RAGE
    );
    queueSoulbeastBuff(
      context,
      event,
      String(fury?.boon || 'fury'),
      Number(fury?.duration ?? 3),
      Number(fury?.stacks ?? 1),
      'Bestial Rage',
      TRAIT.BESTIAL_RAGE
    );
  }
}

// Predator's Cunning triggers a flat-coefficient strike on every Poisoned application, not once per tick.
export function reactToSoulbeastCondition(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (event.condition !== 'Poisoned' || !hasTrait(context, TRAIT.PREDATORS_CUNNING)) {
    return;
  }

  const strike = profileEffect(context, PROFILE.predatorsCunning, 'strike');
  context.queue.enqueue(
    buildResolverStrike({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.PREDATORS_CUNNING,
      actorType: 'effect',
      skillId: TRAIT.PREDATORS_CUNNING,
      skillName: "Predator's Cunning",

      coefficient: Number(strike?.coefficient ?? 0.006),
      hits: Number(strike?.hits ?? 1),

      totalHits: Number(strike?.hits ?? 1),
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

  const profile = balanceProfileFromContext(context, PROFILE.essenceOfSpeed);
  state.essenceOfSpeedReadyAt = event.at + Number(profile?.internalCooldown ?? 5);
  return {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: 'effect',
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: 'Essence of Speed',
    duration: Number(profile?.durationMultiplier ?? 2),
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
  const profile = balanceProfileFromContext(
    context,
    event.kind === 'one-wolf-pack' ? PROFILE.oneWolfPack : PROFILE.vultureStance
  );
  // Allies begin attacking in combat; waiting to engage never extends the shared stance's expiry.
  const start = Math.max(event.at, context.combatStartTime ?? event.at);
  for (const proc of gw2AlliedPlayerProcTimeline(context.config, {
    start,
    duration: Math.max(0, event.at + Number(event.duration || 0) - start),
    maximumAllies,
    internalCooldown: Number(profile?.internalCooldown ?? (event.kind === 'one-wolf-pack' ? 1 : 0.25))
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
  const weakness = profileEffect(context, PROFILE.wintersBite, 'condition');
  queueCondition(
    context,
    event,
    String(weakness?.condition || 'Weakness'),
    Number(weakness?.duration ?? 10),
    ID.WINTERS_BITE,
    "Winter's Bite",
    Number(weakness?.stacks ?? 1)
  );
}
