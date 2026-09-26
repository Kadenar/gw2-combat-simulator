import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';

import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { denySkillCast as deny } from '#gw2/professions/shared/availability.js';

const AMBUSH_SKILL_IDS = new Set<number>([ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

/** Queue fresh boons with shared duration scaling while preserving the trait's recipient selection. */
function queueTraitBuff(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  kind: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string,
  party = false
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
      name: `${name} - ${kind}`,
      kind,
      duration,
      stacks,
      ...(party ? { audience: { recipients: 'party' as const, maximumRecipients: 5 } } : {}),
      triggeredBy: event.skillName
    })
  );
}

function queueTraitCondition(
  context: RangerResolverContext,
  event: Gw2ResolverEvent,
  condition: string,
  duration: number,
  stacks: number,
  sourceId: number,
  name: string
): void {
  context.queue.enqueue(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: sourceId,
      skillName: name,
      name: `${name} - ${condition}`,
      condition,
      duration,
      stacks,
      triggeredBy: event.skillName
    })
  );
}

function triggerFerociousSymbiosis(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS)) return;
  const state = untamedState.from(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.ferociousSymbiosis);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  const internalCooldown = balanceProfileNumber(profile, 'internalCooldown');
  if (isPlayerStrike(event)) {
    if (!isInternalCooldownReady(event.at, state.ferociousSymbiosisPetReadyAt)) return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPetStacks =
      event.at < state.ferociousSymbiosisPetUntil ? Math.min(maximumStacks, state.ferociousSymbiosisPetStacks + 1) : 1;
    state.ferociousSymbiosisPetUntil = event.at + duration;
    state.ferociousSymbiosisPetReadyAt = event.at + internalCooldown;
  } else if (isPetStrike(event)) {
    if (!isInternalCooldownReady(event.at, state.ferociousSymbiosisPlayerReadyAt)) return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayerStacks =
      event.at < state.ferociousSymbiosisPlayerUntil
        ? Math.min(maximumStacks, state.ferociousSymbiosisPlayerStacks + 1)
        : 1;
    state.ferociousSymbiosisPlayerUntil = event.at + duration;
    state.ferociousSymbiosisPlayerReadyAt = event.at + internalCooldown;
  }
}

function triggerLetLoose(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.LET_LOOSE) ||
    // Let Loose only procs on the two ambush skills (Relentless Whirl, Deft Strike).
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }

  const activations = untamedState.from(context).letLooseActivations;
  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (activations[event.activationId]) return;
  activations[event.activationId] = true;
  const profile = requireBalanceProfileFromContext(context, PROFILE.letLoose);
  // Each named boon is independent, so removing one keeps its sibling bound to its own values.
  for (const name of ['quickness', 'might']) {
    const effect = requireEffect(profile, 'boon', name);
    if (!effect) continue;
    queueTraitBuff(
      context,
      event,
      String(effect.boon),
      effectNumber(profile, effect, 'duration'),
      effectNumber(profile, effect, 'stacks'),
      TRAIT.LET_LOOSE,
      'Let Loose',
      true
    );
  }
}

function triggerBlindingOutburst(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (event.skillId !== ID.VENOMOUS_OUTBURST || !hasTrait(context, TRAIT.BLINDING_OUTBURST)) {
    return;
  }

  const profile = requireBalanceProfileFromContext(context, PROFILE.blindingOutburst);
  const blindness = requireEffect(profile, 'condition', 'Blindness');
  if (!blindness) return;
  queueTraitCondition(
    context,
    event,
    String(blindness.condition),
    effectNumber(profile, blindness, 'duration'),
    effectNumber(profile, blindness, 'stacks'),
    TRAIT.BLINDING_OUTBURST,
    'Blinding Outburst'
  );
}

export function reactToUntamedDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
    !(Number(event.coefficient) > 0) ||
    (!isPlayerStrike(event) && !isPetStrike(event))
  ) {
    return;
  }

  triggerBlindingOutburst(context, event);
  triggerFerociousSymbiosis(context, event);
  // Let Loose is player-only; pet hits cannot trigger it.
  if (isPlayerStrike(event)) triggerLetLoose(context, event);
}

export function reactToUntamedControl(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!isPlayerStrike(event) && !isPetStrike(event)) return;
  const state = untamedState.from(context);
  if (
    hasTrait(context, TRAIT.DEBILITATING_BLOWS) &&
    isInternalCooldownReady(event.at, state.debilitatingBlowsReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.debilitatingBlows);
    // Unleash state determines which condition is applied: Poisoned when Ranger unleashed, Slow otherwise.
    const condition = requireEffect(profile, 'condition', state.rangerUnleashed ? 'Poisoned' : 'Slow');
    // The cooldown gates only the selected condition, so a removed packet leaves it ready.
    if (condition) {
      state.debilitatingBlowsReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
      queueTraitCondition(
        context,
        event,
        String(condition.condition),
        effectNumber(profile, condition, 'duration'),
        effectNumber(profile, condition, 'stacks'),
        TRAIT.DEBILITATING_BLOWS,
        'Debilitating Blows'
      );
    }
  }

  if (hasTrait(context, TRAIT.ENHANCING_IMPACT) && isInternalCooldownReady(event.at, state.enhancingImpactReadyAt)) {
    const profile = requireBalanceProfileFromContext(context, PROFILE.enhancingImpact);
    // Unleash state determines the boon: Quickness when Ranger unleashed, Stability otherwise.
    const effect = requireEffect(profile, 'boon', state.rangerUnleashed ? 'quickness' : 'stability');
    // The cooldown gates only the selected boon, so a removed packet leaves it ready.
    if (effect) {
      state.enhancingImpactReadyAt = event.at + balanceProfileNumber(profile, 'internalCooldown');
      queueTraitBuff(
        context,
        event,
        String(effect.boon),
        effectNumber(profile, effect, 'duration'),
        effectNumber(profile, effect, 'stacks'),
        TRAIT.ENHANCING_IMPACT,
        'Enhancing Impact'
      );
    }
  }
}

export function untamedCastAvailability(context: RangerRuntime, skill: RangerSkill): AvailabilityResult {
  const state = untamedState.from(context);
  if (skill.id === ID.UNLEASH_RANGER && state.rangerUnleashed) {
    return deny(skill, 'ranger.ranger-unleashed', 'the ranger is already unleashed.');
  }

  if (skill.id === ID.UNLEASH_PET && !state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-unleashed', 'the pet is already unleashed.');
  }

  if (skill.unleashedPetSkill && state.rangerUnleashed) {
    return deny(skill, 'ranger.pet-not-unleashed', 'Unleash Pet first.');
  }

  if (skill.unleashedAmbushSkill) {
    if (!state.rangerUnleashed) {
      return deny(skill, 'ranger.not-unleashed', 'Unleash Ranger first.');
    }

    // ambushReadyUntil is a deadline, not a cooldown: the window closes when time reaches it.
    if (context.time >= state.ambushReadyUntil) {
      return deny(skill, 'ranger.ambush-unavailable', 'unleash to make an ambush available.');
    }
  }

  return { ready: true };
}
