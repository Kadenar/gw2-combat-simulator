import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { isPetStrike, isPlayerStrike } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { rangerPetCompanionId } from '#gw2/professions/ranger/core/mechanics/pets.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { TRAITS } from '#gw2/professions/ranger/data/traits-data.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { UNTAMED_AMBUSH_SKILL_IDS } from '#gw2/professions/ranger/data/untamed-ambushes.js';
import type { RangerResolverContext } from '#gw2/professions/ranger/types.js';

/** Ambushes retain their authored first-hit timing and unconditional life-steal packet. */
export function naturalFortitudeAmbushEffect(atMs: number): SkillEffect {
  return {
    type: 'strike',
    sourceId: TRAIT.NATURAL_FORTITUDE,
    name: 'Natural Fortitude',
    // Separate the siphon in the breakdown while retaining the ambush's combat attribution.
    damageBreakdownName: 'Life Siphon - Natural Fortitude',
    // Use the granting trait's artwork instead of the triggering ambush's icon.
    icon: String(TRAITS.find((trait) => trait.id === TRAIT.NATURAL_FORTITUDE)?.icon || ''),
    // Life siphon adds Power to its base damage without weapon, armor, or critical scaling.
    ticks: [{ atMs, coefficient: 0 }],
    flatStrikeBase: 3517,
    flatStrikePowerCoeff: 0.005,
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    canCrit: false,
    damageKind: 'life-steal'
  };
}

export function triggerFerociousSymbiosis(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, TRAIT.FEROCIOUS_SYMBIOSIS)) return;
  const state = untamedState.from(context);
  const profile = requireBalanceProfileFromContext(context, TRAIT.FEROCIOUS_SYMBIOSIS);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  if (isPlayerStrike(event)) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPet', event.at)) return;
    // A player hit builds Pet stacks (cross-buff: player hits power the pet).
    state.ferociousSymbiosisPet = grantRefreshedStacks(
      state.ferociousSymbiosisPet,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  } else if (isPetStrike(event)) {
    if (!context.procs.claim(TRAIT.FEROCIOUS_SYMBIOSIS, 'ranger.untamed.ferociousSymbiosisPlayer', event.at)) return;
    // A pet hit builds Player stacks (cross-buff: pet hits power the player).
    state.ferociousSymbiosisPlayer = grantRefreshedStacks(
      state.ferociousSymbiosisPlayer,
      1,
      event.at,
      event.at + duration,
      maximumStacks,
      'exclusive'
    );
  }
}

export function triggerLetLoose(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.LET_LOOSE) ||
    // Every supported weapon ambush can grant Let Loose on its first landed strike.
    !AMBUSH_SKILL_IDS.has(Number(event.skillId)) ||
    // activationId is absent on synthetic events; guard prevents double-counting.
    !event.activationId
  ) {
    return;
  }

  // Each ambush activation grants boons exactly once even if the skill hits multiple times.
  if (!claimActivation(untamedState.from(context).untamedActivationClaims, 'ranger.let-loose', event.activationId))
    return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.LET_LOOSE);
  // Expand each surviving boon once per accepted ambush, preserving the party audience.
  context.effects.emit({
    kind: 'profile',
    profile,
    effects: profile.effects?.filter((effect) => effect.type === 'boon'),
    at: event.at,
    durationContext: event,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.LET_LOOSE,
      actorType: 'effect',
      skillId: TRAIT.LET_LOOSE,
      skillName: 'Let Loose',
      triggeredBy: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      name: 'Let Loose - ' + packet.kind,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: context.profession.core.petActive ? [rangerPetCompanionId(context)] : []
      }
    })
  });
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

const AMBUSH_SKILL_IDS = new Set<number>(UNTAMED_AMBUSH_SKILL_IDS);

/** Reconciles Untamed's Natural Fortitude at the existing Druid-only runtime attribute boundary. */
export function modifyNaturalFortitudeAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats
): Gw2ResolvedStats {
  if (!hasTrait(context, TRAIT.NATURAL_FORTITUDE)) return attributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (staticRulesApplied && context.event?.actorType === 'summon') return attributes;
  const result = { ...attributes };
  const naturalFortitudeProfile = requireBalanceProfileFromContext(context, TRAIT.NATURAL_FORTITUDE);
  const vitality = balanceProfileNumber(naturalFortitudeProfile, 'attributeBonus');
  result.vitality = (result.vitality || 0) + (staticRulesApplied ? 0 : vitality);
  return result;
}
