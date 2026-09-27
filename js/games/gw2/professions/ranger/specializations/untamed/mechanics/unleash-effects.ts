import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerResolverContext, RangerSkill, RangerRuntime } from '#gw2/professions/ranger/types.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';

import { UNTAMED_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import { denySkillCast as deny } from '#gw2/platform/engine/skills/availability.js';

const AMBUSH_SKILL_IDS = new Set<number>([ID.RELENTLESS_WHIRL, ID.DEFT_STRIKE]);

function triggerFerociousSymbiosis(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS)) return;
  const state = untamedState.from(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.ferociousSymbiosis);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  if (isPlayerStrike(event)) {
    if (!context.procs.claim(PROFILE.ferociousSymbiosis, 'ranger.untamed.ferociousSymbiosisPet', event.at)) return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPetStacks =
      event.at < state.ferociousSymbiosisPetUntil ? Math.min(maximumStacks, state.ferociousSymbiosisPetStacks + 1) : 1;
    state.ferociousSymbiosisPetUntil = event.at + duration;
  } else if (isPetStrike(event)) {
    if (!context.procs.claim(PROFILE.ferociousSymbiosis, 'ranger.untamed.ferociousSymbiosisPlayer', event.at)) return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayerStacks =
      event.at < state.ferociousSymbiosisPlayerUntil
        ? Math.min(maximumStacks, state.ferociousSymbiosisPlayerStacks + 1)
        : 1;
    state.ferociousSymbiosisPlayerUntil = event.at + duration;
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
  // Expand each surviving boon once per accepted ambush, preserving the party audience.
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'boon') continue;
    for (const { event: packet } of materializeSkillEffectApplications({
      skill: profile,
      effect,
      start: event.at,
      fullEnd: event.at,
      baseEvent: {
        source: 'Trait',
        sourceId: TRAIT.LET_LOOSE,
        actorType: 'effect',
        skillId: TRAIT.LET_LOOSE,
        skillName: 'Let Loose',
        triggeredBy: event.skillName
      }
    }))
      queueResolverBoon(context, event, {
        ...packet,
        type: 'buff',
        kind: String(packet.kind),
        duration: Number(packet.duration),
        name: 'Let Loose - ' + packet.kind,
        audience: { recipients: 'party', maximumRecipients: 5 }
      });
  }
}

export function reactToUntamedDamage(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    // Only hitting strikes (coefficient > 0) advance trait state; misses and barrier hits are excluded.
    !(Number(event.coefficient) > 0) ||
    (!isPlayerStrike(event) && !isPetStrike(event))
  ) {
    return;
  }

  triggerFerociousSymbiosis(context, event);
  // Let Loose is player-only; pet hits cannot trigger it.
  if (isPlayerStrike(event)) triggerLetLoose(context, event);
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
