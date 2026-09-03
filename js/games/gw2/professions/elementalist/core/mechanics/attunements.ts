/**
 * Owns Core Elementalist attunement selection, recharge, and cast-completion transitions.
 * Specializations may intercept the shared hooks but keep their extra state locally.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistCastContext, ElementalistPrecastContext } from '#gw2/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import {
  ATTUNEMENT_RECHARGE_SECONDS,
  OFF_ATTUNEMENT_RECHARGE_SECONDS
} from '#gw2/professions/elementalist/core/constants.js';
import { combatStarted } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import {
  applyElementalistAttunementTraits,
  projectedFreshAirReadyAt
} from '#gw2/professions/elementalist/core/traits/index.js';
import {
  inFlightAutoattackCarryover,
  progressedAutoattackCarryover
} from '#gw2/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Identifies one shared attunement-entry trait effect so a specialization can veto it. */
export interface ElementalistAttunementTraitTrigger {
  readonly attunement: ElementalistAttunement;
  readonly profileId: Skill['id'];
}

/**
 * Specialization-supplied overrides for a single attunement swap: the secondary
 * attunement to report, a replacement recharge policy, and a trait-effect veto.
 */
export interface ElementalistAttunementTransition {
  readonly secondaryAttunement?: ElementalistAttunement | null;
  readonly rechargeDuration?: number;
  readonly shouldTriggerAttunementTrait?: (trigger: ElementalistAttunementTraitTrigger) => boolean;
}

/** Maps an attunement-swap skill to the attunement it enters, or null for any other skill. */
export function targetAttunement(skill: Skill): ElementalistAttunement | null {
  return (
    ELEMENTALIST_ATTUNEMENTS.find((attunement) => ELEMENTALIST_ATTUNEMENT_SKILL_IDS[attunement] === skill.id) ?? null
  );
}

/** Applies alacrity's recharge scaling to an Elementalist mechanic duration. */
export function elementalistAlacrityAdjustedDuration(context: ElementalistCastContext, seconds: number): number {
  return context.config.boons?.alacrity ? seconds / 1.25 : seconds;
}

/** Resolves the effective attunement recharge after Elemental Enchantment and alacrity. */
export function elementalistAttunementRechargeDuration(context: ElementalistCastContext, seconds: number): number {
  let adjusted = seconds;
  if (hasTrait(context, 'Elemental Enchantment')) {
    adjusted *= balanceProfileValueFromContext(context, PROFILE.elementalEnchantment, 'rechargeMultiplier', 0.85);
  }

  return elementalistAlacrityAdjustedDuration(context, adjusted);
}

/**
 * Commits a completed attunement swap: carries autoattack chain progress across
 * the swap, arms the attunement recharges, publishes the attunement and sigil
 * swap events, and fires the shared on-entry trait effects once combat started.
 */
export function onAttunementComplete(
  context: ElementalistCastContext,
  skill: Skill,
  target: ElementalistAttunement,
  transition: ElementalistAttunementTransition = {}
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const previous = state.primaryAttunement;
  const attunementReadyAtBefore = { ...state.attunementReadyAt };
  // Preserve chain progress for the attunement being left; a cast still in flight
  // is only held as pending until it commits.
  state.autoattackCarryover = progressedAutoattackCarryover(context, state, previous);
  state.pendingAutoattackCarryover = state.autoattackCarryover ? null : inFlightAutoattackCarryover(context, previous);
  // Specializations may supply their own transition and recharge policy while Core keeps shared entry effects here.
  const dualAttunement = transition.rechargeDuration != null;
  if (dualAttunement) {
    state.primaryAttunement = target;
    const recharge = Number(transition.rechargeDuration);
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
  } else {
    state.primaryAttunement = target;
    // Single swap: the attunement just left takes the full recharge, while the two
    // untouched attunements only serve the short off-attunement delay.
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        state.attunementReadyAt[previous],
        at +
          elementalistAttunementRechargeDuration(
            context,
            balanceProfileValueFromContext(context, PROFILE.resources, 'recharge', ATTUNEMENT_RECHARGE_SECONDS)
          )
      )
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      const existingReadyAt = state.attunementReadyAt[attunement];
      const defaultReadyAt =
        at +
        elementalistAttunementRechargeDuration(
          context,
          balanceProfileValueFromContext(context, PROFILE.resources, 'initialDelay', OFF_ATTUNEMENT_RECHARGE_SECONDS)
        );
      let nextReadyAt = Math.max(existingReadyAt, defaultReadyAt);
      // Fresh Air can pull Air's ready time in ahead of its scheduled recharge.
      if (attunement === 'Air' && hasTrait(context, 'Fresh Air')) {
        const freshAirReadyAt = projectedFreshAirReadyAt(context as unknown as ElementalistPrecastContext, nextReadyAt);
        if (freshAirReadyAt != null) {
          nextReadyAt = Math.min(nextReadyAt, freshAirReadyAt);
        }
      }

      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }

  // Publish the swap for the resolver and presentation, then trigger weapon sigils.
  state.attunementEnteredAt = at;
  context.emit({
    type: 'elementalist.attunement',
    at,
    priority: -20,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    commandIndex: context.commandIndex,
    from: previous,
    to: target,
    secondaryAttunement: transition.secondaryAttunement ?? null,
    attunementReadyAtBefore
  });
  context.emit({
    type: 'sigil_swap',
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name
  });
  // Pre-combat swaps still move state and timers but grant no trait effects.
  if (!combatStarted(context, at)) return;

  // Specializations can gate shared attunement-trait effects without Core inspecting specialization state or policy.
  const shouldTriggerAttunementTrait = (attunement: ElementalistAttunement, profileId: Skill['id']): boolean =>
    transition.shouldTriggerAttunementTrait?.({ attunement, profileId }) !== false;

  applyElementalistAttunementTraits(context, {
    at,
    skill,
    previous,
    target,
    dualAttunement,
    shouldTrigger: shouldTriggerAttunementTrait
  });
}
