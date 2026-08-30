import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
/** Soulbeast resolver-phase reactions and event handlers. */
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isStandardBoon } from '#gw2/platform/combat/state/boons.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/state/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerResolverEvent } from '#gw2/content/professions/ranger/types.js';
import { rangerPetByName } from '#gw2/content/professions/ranger/core/state.js';
import { soulbeastState } from '#gw2/content/professions/ranger/specializations/soulbeast/state.js';
import {
  rangerBalanceProfile,
  rangerBalanceProfileEffect,
  RANGER_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE
} from '#gw2/content/professions/ranger/core/profiles.js';
import { SOULBEAST_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/ranger/specializations/soulbeast/profiles.js';
import { isPlayerStrike } from '#gw2/content/professions/ranger/core/mechanics/resolution-helpers.js';

function profileEffect(context: unknown, id: number | string, type: string, index = 0) {
  return rangerBalanceProfileEffect(rangerBalanceProfile(context, id), type, index);
}

export function handleSoulbeastModeEvent(context: RangerResolverContext, event: RangerResolverEvent): void {
  soulbeastState.from(context).beastmodeActive = event.active === true;
}

// Extends active boon applications in the live boon map; only applications already running at event.at are stretched.
export function handleRangerBoonExtension(context: RangerResolverContext, event: RangerResolverEvent): void {
  const extension = Math.max(0, Number(event.duration || 0));
  const excluded = String(event.excludedKind || '');
  if (!(extension > 0)) return;
  for (const [kind, applications] of context.boons) {
    if (!isStandardBoon(kind) || kind === excluded) continue;
    for (const application of applications) {
      if (application.affectsSelf !== false && application.at <= event.at && application.expiresAt > event.at) {
        // Cast needed because the runtime type treats expiresAt as readonly after resolution.
        (application as { expiresAt: number }).expiresAt += extension;
      }
    }
  }
}

export const soulbeastEventHandlers = Object.freeze({
  'ranger.beastmode': handleSoulbeastModeEvent,
  'ranger.boon-extension': handleRangerBoonExtension
});

export function activeSoulbeastBuff(context: RangerResolverContext, kind: string, at: number): boolean {
  return (context.boons.get(kind) || []).some(
    (application: Gw2TimedBuffApplication) =>
      application.at <= at && application.expiresAt > at && application.stacks > 0
  );
}

export function queueSoulbeastBuff(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  name: string,
  sourceId: number
): void {
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name,
    kind,
    duration,
    stacks,
    triggeredBy: event.skillName
  });
}

// Beast Ability is always the last skill in beastmodeSkillIds; traits like Live Fast and Go for the Eyes
// should fire only on the first hit of a multi-hit Beast Ability, not once per packet.
function firstBeastAbilityHit(context: RangerResolverContext, event: RangerResolverEvent): boolean {
  const activePet = rangerPetByName(professionCoreState(context).activePet);
  const beastSkillId = activePet.beastmodeSkillIds.at(-1);
  if (event.skillId !== beastSkillId || !event.activationId) return false;
  const activations = soulbeastState.from(context).beastAbilityActivations;
  if (activations[event.activationId]) return false;
  activations[event.activationId] = true;
  return true;
}

function queueCondition(
  context: RangerResolverContext,
  event: RangerResolverEvent,
  condition: string,
  duration: number,
  sourceId: number,
  name: string
): void {
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name: `${name} — ${condition}`,
    condition,
    duration,
    stacks: 1,
    triggeredBy: event.skillName
  });
}

/** Consumes Poisonous Strikes from player hits only while Soulbeast replaces its pet in Beastmode. */
function triggerMergedPoisonousStrikes(context: RangerResolverContext, event: RangerResolverEvent): void {
  const core = professionCoreState(context);
  if (event.at > core.poisonousStrikesExpiresAt) core.poisonousStrikesCharges = 0;
  if (
    !soulbeastState.from(context).beastmodeActive ||
    core.poisonousStrikesCharges <= 0 ||
    !isPlayerStrike(event) ||
    !(Number(event.coefficient) > 0)
  ) {
    return;
  }

  core.poisonousStrikesCharges -= 1;
  const poison = profileEffect(context, CORE_PROFILE.poisonousStrikes, 'condition');
  enqueueOrdered(context.queue, {
    type: 'condition',
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
  });
}

export function reactToSoulbeastDamage(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (!(Number(event.coefficient) > 0)) return;
  const state = soulbeastState.from(context);
  triggerMergedPoisonousStrikes(context, event);

  // One Wolf Pack must not trigger from its own echo or from effect-sourced hits to avoid infinite recursion.
  if (
    event.actorType !== 'effect' &&
    event.sourceId !== ID.ONE_WOLF_PACK_STRIKE &&
    activeSoulbeastBuff(context, 'one-wolf-pack', event.at) &&
    isInternalCooldownReady(event.at, state.oneWolfPackReadyAt)
  ) {
    const profile = rangerBalanceProfile(context, PROFILE.oneWolfPack);
    const strike = rangerBalanceProfileEffect(profile, 'strike');
    // 1-second ICD between echoes even within a single multi-hit skill.
    state.oneWolfPackReadyAt = event.at + Number(profile?.internalCooldown ?? 1);
    enqueueOrdered(context.queue, {
      type: 'damage',
      at: event.at + Number(profile?.initialDelay ?? 0.28),
      source: 'ranger',
      sourceId: ID.ONE_WOLF_PACK_STRIKE,
      actorType: 'effect',
      skillId: ID.ONE_WOLF_PACK,
      skillName: 'One Wolf Pack',
      name: 'One Wolf Pack',
      coefficient: Number(strike?.coefficient ?? 0.95),
      hits: Number(strike?.hits ?? 1),
      hitIndex: 1,
      totalHits: Number(strike?.hits ?? 1),
      skillWeapon: event.skillWeapon || 'Unequipped',
      weaponStrengthProfileId: event.weaponStrengthProfileId,
      canCrit: true,
      triggeredBy: event.skillName
    });
  }

  // Vulture Stance procs per player hit with a 0.25 s ICD; effect-sourced hits (e.g. OWP echoes) are excluded.
  if (
    activeSoulbeastBuff(context, 'vulture-stance', event.at) &&
    isInternalCooldownReady(event.at, state.vultureStanceReadyAt) &&
    event.actorType !== 'effect'
  ) {
    const profile = rangerBalanceProfile(context, PROFILE.vultureStance);
    const poison = rangerBalanceProfileEffect(profile, 'condition');
    const might = rangerBalanceProfileEffect(profile, 'boon');
    state.vultureStanceReadyAt = event.at + Number(profile?.internalCooldown ?? 0.25);
    queueCondition(
      context,
      event,
      String(poison?.condition || 'Poisoned'),
      Number(poison?.duration ?? 4),
      ID.VULTURE_STANCE,
      'Vulture Stance'
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
      'Wilting Strike'
    );
  }

  if (hasTrait(context, TRAIT.GO_FOR_THE_EYES) && isInternalCooldownReady(event.at, state.goForTheEyesReadyAt)) {
    const profile = rangerBalanceProfile(context, PROFILE.goForTheEyes);
    const blind = rangerBalanceProfileEffect(profile, 'blind');
    state.goForTheEyesReadyAt = event.at + Number(profile?.internalCooldown ?? 12);
    enqueueOrdered(context.queue, {
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
    const profile = rangerBalanceProfile(context, CORE_PROFILE.goForTheThroat);
    const lesserSicEm = rangerBalanceProfileEffect(profile, 'buff', 1);
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
export function reactToSoulbeastControl(context: RangerResolverContext, event: RangerResolverEvent): void {
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
    const profile = rangerBalanceProfile(context, PROFILE.bestialRage);
    const might = rangerBalanceProfileEffect(profile, 'boon', 0);
    const fury = rangerBalanceProfileEffect(profile, 'boon', 1);
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
export function reactToSoulbeastCondition(context: RangerResolverContext, event: RangerResolverEvent): void {
  if (event.condition !== 'Poisoned' || !hasTrait(context, TRAIT.PREDATORS_CUNNING)) {
    return;
  }

  const strike = profileEffect(context, PROFILE.predatorsCunning, 'strike');
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.PREDATORS_CUNNING,
    actorType: 'effect',
    skillId: TRAIT.PREDATORS_CUNNING,
    skillName: "Predator's Cunning",
    name: "Predator's Cunning",
    coefficient: Number(strike?.coefficient ?? 0.006),
    hits: Number(strike?.hits ?? 1),
    hitIndex: 1,
    totalHits: Number(strike?.hits ?? 1),
    skillWeapon: 'Unequipped',
    canCrit: false,
    triggeredBy: event.skillName
  });
}

// Essence of Speed reacts to each quickness application and extends all other boons by 2 s, with a 5 s ICD.
// Quickness itself is excluded from the extension to prevent runaway stacking.
export function reactToSoulbeastBuff(context: RangerResolverContext, event: RangerResolverEvent): void {
  const state = soulbeastState.from(context);
  if (
    event.kind !== 'quickness' ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !isInternalCooldownReady(event.at, state.essenceOfSpeedReadyAt)
  ) {
    return;
  }

  const profile = rangerBalanceProfile(context, PROFILE.essenceOfSpeed);
  state.essenceOfSpeedReadyAt = event.at + Number(profile?.internalCooldown ?? 5);
  enqueueOrdered(context.queue, {
    type: 'ranger.boon-extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.ESSENCE_OF_SPEED,
    actorType: 'effect',
    skillId: TRAIT.ESSENCE_OF_SPEED,
    skillName: 'Essence of Speed',
    duration: Number(profile?.durationMultiplier ?? 2),
    excludedKind: 'quickness'
  });
}

// Winter's Bite fires once per weapon skill hit via the ranger core flag; the flag is cleared here
// and is reset by the ranger core when a new weapon cycle begins, not on cooldown expiry.
export function reactToRangerWinterBite(context: RangerResolverContext, event: RangerResolverEvent): void {
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
    "Winter's Bite"
  );
}
