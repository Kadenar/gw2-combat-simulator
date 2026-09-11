import { emitThiefStateSnapshot } from '#gw2/professions/thief/state.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { applyActiveVenoms } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { applyFluidStrikes, applyHardToCatch } from '#gw2/professions/thief/core/traits/acrobatics.js';
import {
  applyAssassinsFury,
  noQuarterCriticalReaction,
  unrelentingStrikesCriticalReaction
} from '#gw2/professions/thief/core/traits/critical-strikes.js';
import {
  applyDeadlyAmbition,
  applyEvenTheOdds,
  applyMug,
  applyPanicStrike,
  applyPanicStrikePoison,
  applySerpentsTouch
} from '#gw2/professions/thief/core/traits/deadly-arts.js';
import {
  applyAlliedLeechingVenoms,
  applyCloakedInShadow,
  applyHiddenThief,
  applyLeechingVenoms,
  applyShadowSiphoning
} from '#gw2/professions/thief/core/traits/shadow-arts.js';
import {
  applyBountifulTheft,
  applyDeadlyAmbush,
  applyKleptomaniac,
  applyLeadAttacks,
  applySleightOfHand,
  applyThrillOfTheCrime
} from '#gw2/professions/thief/core/traits/trickery.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSkill
} from '#gw2/professions/thief/types.js';

export {
  observeThiefCriticalBoons,
  materializeThiefCriticalBoons
} from '#gw2/professions/thief/core/traits/critical-strikes.js';

/** Dispatches selected on-steal traits in the cross-line order shared by every steal variant. */
export function emitStealTraitEffects(context: ThiefCastContext): void {
  const at = context.effectiveEnd;
  applySerpentsTouch(context, at);
  applyMug(context, at);
  applyEvenTheOdds(context, at);
  applyDeadlyAmbush(context, at);
  applyThrillOfTheCrime(context, at);
  applyBountifulTheft(context, at);
  applySleightOfHand(context, at);
  applyHiddenThief(context, at);
}

/** Applies Core steal resources before the active specialization grant and the final stolen-skill snapshot. */
export function applyStealCompletionTraits(context: ThiefCastContext, at: number): void {
  applyKleptomaniac(context, at);
  context.onThiefStealComplete?.(context);
}

/** Dispatches initiative, movement, and dual-wield trait state at cast completion. */
export function updateThiefTraitCastState(context: ThiefCastContext, skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  applyLeadAttacks(context, skill, at);
  if (skill.movementSkill) {
    const fluidStrikesChanged = applyFluidStrikes(context, at);
    const hardToCatchApplied = applyHardToCatch(context, at);
    if (fluidStrikesChanged && !hardToCatchApplied) {
      emitThiefStateSnapshot(context, at, 'fluid-strikes');
    }
  }

  applyDeadlyAmbition(context, skill, at);
}

export const thiefCoreCriticalReactions = Object.freeze({
  unrelentingStrikes: unrelentingStrikesCriticalReaction,
  noQuarter: noQuarterCriticalReaction
});

/** Routes resolved boons through the ordered Core Thief buff reactions. */
export function reactToThiefCoreBuff(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  applyAssassinsFury(context, event);
}

/** Runs damage reactions after the base venom packet in their established cross-line order. */
export function reactToThiefCoreDamage(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  const venomProcs = applyActiveVenoms(context, event);
  for (let index = 0; index < venomProcs; index += 1) applyLeechingVenoms(context, event);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event);
}

// Base Unsuspecting Strike handling remains last so trait-derived condition
// reactions materialize first at the same timestamp.
function applyUnsuspectingStrikeBonus(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (application.condition !== 'Bleeding' || Number(application.bonusAboveNinetyStacks || 0) <= 0) return;
  const maximum = Number(context.config?.target?.health || 0);
  const damage = targetHealthLoss(context.config, context);
  if (!(maximum > 0) || damage / maximum < 0.1) {
    context.queue.enqueue({
      ...application,
      type: 'condition',
      name: 'Unsuspecting Strike - Bonus Bleeding',
      condition: application.condition,
      duration: Number(application.duration || 0),
      stacks: Number(application.bonusAboveNinetyStacks),
      bonusAboveNinetyStacks: 0
    });
  }
}

/** Routes resolved conditions through trait reactions before the base skill bonus. */
export function reactToThiefCoreCondition(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  applyAlliedLeechingVenoms(context, application);
  applyPanicStrikePoison(context, application);
  applyCloakedInShadow(context, application);
  applyUnsuspectingStrikeBonus(context, application);
}
