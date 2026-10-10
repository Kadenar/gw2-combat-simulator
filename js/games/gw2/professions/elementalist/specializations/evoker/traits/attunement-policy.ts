import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denyCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  targetAttunement,
  type ElementalistAttunementTraitTrigger
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/**
 * Spends an armed Elemental Balance window on the next non-autoattack weapon
 * skill, scaling its recharge by the profile multiplier. The window is
 * single-use and is cleared here as soon as one skill consumes it.
 */
export function commitRechargeDuration(context: ElementalistRuntime, skill: Skill, duration: number): number {
  // Weapon_1 excluded — auto-attacks don't benefit from Elemental Balance CDR
  if (skill.type !== 'Weapon' || String(skill.slot) === 'Weapon_1' || !hasTrait(context, TRAIT.ELEMENTAL_BALANCE)) {
    return duration;
  }

  const state = evokerState.from(context);
  if (state.elementalBalanceUntil <= context.time) {
    return duration;
  }

  state.elementalBalanceUntil = 0; // single-use window; next arm cycle starts fresh
  const elementalBalanceProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_BALANCE);
  return duration * balanceProfileNumber(elementalBalanceProfile, 'rechargeMultiplier');
}

/** Specialized Elements selects the active charge cap and matching-element gain from its own profile. */
export function evokerChargeProfile(context: unknown) {
  return requireBalanceProfileFromContext(
    context,
    hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS) ? TRAIT.SPECIALIZED_ELEMENTS : PROFILE.resources
  );
}

/** A selected fixed element rejects manual attunement swaps before familiar availability checks. */
export function specializedElementsAvailability(
  context: MechanicQueriesOf<ElementalistRuntime>,
  skill: Skill
): AvailabilityResult {
  return targetAttunement(skill) && hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS)
    ? denyCast(
        'elementalist.specialized-elements',
        `${skill.name} is unavailable - attunement swapping is disabled by Specialized Elements.`
      )
    : { ready: true };
}

/** Retain each existing percentage-recharge patch identity under its trait owner. */
export const SPECIALIZED_ELEMENTS_PROFILE_IDS = Object.freeze({
  basicRecharge: 'elementalist.evoker.specialized-elements.basic-recharge',
  empoweredRecharge: 'elementalist.evoker.specialized-elements.empowered-recharge'
});

// Evocation's five-second trait ICD applies to some Fire and Earth entry effects
const EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES = new Set<Skill['id']>([
  TRAIT.SUNSPOT,
  TRAIT.PYROMANCERS_PUISSANCE,
  TRAIT.EARTHEN_BLAST,
  TRAIT.ROCK_SOLID
]);

// reports whether the trait may proc now, arming its next Evocation ICD window when it may
export function consumeEvokerAttunementTraitCooldown(
  context: ElementalistRuntime,
  at: number,
  profileId: Skill['id']
): boolean {
  const evocationProfile = requireBalanceProfileFromContext(context, TRAIT.EVOCATION);
  // Both real and familiar-triggered entries share a per-profile claim before downstream effects.
  return context.procs.claimCooldown(String(profileId), at, balanceProfileNumber(evocationProfile, 'internalCooldown'));
}

/** Evocation claims a per-trait ICD only for entries into the selected familiar element. */
export function evocationAllowsAttunementTrait(
  context: ElementalistRuntime,
  at: number,
  { attunement, profileId }: ElementalistAttunementTraitTrigger
): boolean {
  return (
    !EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES.has(profileId) ||
    evokerState.from(context).element !== attunement ||
    consumeEvokerAttunementTraitCooldown(context, at, profileId)
  );
}
