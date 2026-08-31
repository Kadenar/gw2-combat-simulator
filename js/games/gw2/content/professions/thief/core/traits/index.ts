import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { combinedTargetDamage } from '#gw2/platform/combat/state/target-health.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileEffectFromContext as traitEffect,
  balanceProfileFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { gainThiefEndurance } from '#gw2/content/professions/thief/core/mechanics/resource-events.js';
import { snapshotThiefState } from '#gw2/content/professions/thief/core/state.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';
import { applyFluidStrikes, applyHardToCatch } from '#gw2/content/professions/thief/core/traits/acrobatics.js';
import {
  applyAssassinsFury,
  noQuarterCriticalReaction,
  unrelentingStrikesCriticalReaction
} from '#gw2/content/professions/thief/core/traits/critical-strikes.js';
import {
  applyDeadlyAmbition,
  applyEvenTheOdds,
  applyMug,
  applyPanicStrike,
  applyPanicStrikePoison,
  applySerpentsTouch
} from '#gw2/content/professions/thief/core/traits/deadly-arts.js';
import {
  applyAlliedLeechingVenoms,
  applyCloakedInShadow,
  applyHiddenThief,
  applyLeechingVenoms,
  applyShadowSiphoning
} from '#gw2/content/professions/thief/core/traits/shadow-arts.js';
import {
  applyBountifulTheft,
  applyDeadlyAmbush,
  applyKleptomaniac,
  applyLeadAttacks,
  applySleightOfHand,
  applyThrillOfTheCrime
} from '#gw2/content/professions/thief/core/traits/trickery.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSkill
} from '#gw2/content/professions/thief/types.js';

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

/** Applies steal-completion resource traits while retaining the elite compatibility call. */
export function applyStealCompletionTraits(context: ThiefCastContext, at: number): void {
  applyKleptomaniac(context, at);
  if (hasTrait(context.config, TRAIT.ENDURANCE_THIEF)) {
    gainThiefEndurance(
      context,
      Number(balanceProfileFromContext(context, PROFILE.enduranceThief)?.resourceGain || 50),
      at,
      'endurance-thief'
    );
  }
}

/** Dispatches initiative, movement, and dual-wield trait state at cast completion. */
export function updateThiefTraitCastState(context: ThiefCastContext, skill: ThiefSkill): void {
  const at = context.effectiveEnd;
  applyLeadAttacks(context, skill, at);
  if (skill.movementSkill) {
    const fluidStrikesChanged = applyFluidStrikes(context, at);
    const hardToCatchApplied = applyHardToCatch(context, at);
    if (fluidStrikesChanged && !hardToCatchApplied) {
      emitStateSnapshot(context, 'thief', at, 'fluid-strikes', snapshotThiefState(context.state.profession));
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

// Base Spider Venom remains in this dispatcher so trait files do not own or
// consume the underlying skill mechanic.
function applySpiderVenom(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const state = professionCoreState(context);
  if (Number(state.spiderVenomCharges || 0) <= 0 || Number(state.spiderVenomExpiresAt || 0) <= event.at) return;
  state.spiderVenomCharges -= 1;
  const poison = traitEffect(context, PROFILE.spiderVenomProc, 'condition');
  context.applyCondition({
    type: 'condition',
    at: event.at,
    source: 'thief',
    sourceId: ID.SPIDER_VENOM,
    actorType: 'player',
    skillId: ID.SPIDER_VENOM,
    skillName: 'Spider Venom',
    name: 'Spider Venom - Poison',
    condition: String(poison?.condition || 'Poisoned'),
    stacks: Number(poison?.stacks || 1),
    duration: Number(poison?.duration || 3),
    activationId: event.activationId || `${event.skillId}:${event.at}`,
    triggeredBy: event.skillName
  });
  applyLeechingVenoms(context, event);
}

/** Runs damage reactions after the base venom packet in their established cross-line order. */
export function reactToThiefCoreDamage(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  applySpiderVenom(context, event);
  applyShadowSiphoning(context, event);
  applyPanicStrike(context, event);
}

// Base Unsuspecting Strike handling remains last so trait-derived condition
// reactions materialize first at the same timestamp.
function applyUnsuspectingStrikeBonus(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (application.condition !== 'Bleeding' || Number(application.bonusAboveNinetyStacks || 0) <= 0) return;
  const maximum = Number(context.config?.target?.health || 0);
  const damage = combinedTargetDamage(context);
  if (!(maximum > 0) || damage / maximum < 0.1) {
    enqueueOrdered(context.queue, {
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
