import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { handleBlossomingAura } from '#gw2/professions/revenant/core/execution/scepter.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
/**
 * @fileoverview Composes Revenant Energy, weapon, trait, and upkeep
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { revenantCastAvailability } from '#gw2/professions/revenant/core/mechanics/availability.js';
import { advanceRevenantEnergy } from '#gw2/professions/revenant/core/mechanics/energy.js';
import { spendRevenantEnergy } from '#gw2/professions/revenant/energy.js';
import { prepareRevenantHitboxEvent } from '#gw2/professions/revenant/core/mechanics/event-handlers.js';
import { handleRevenantUpkeepPulse } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { completeRevenantFollowup } from '#gw2/professions/revenant/core/mechanics/skill-flips.js';
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  observeRevenantWeaponEvent,
  resetCoalescenceOfRuin
} from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import {
  afterRevenantCast,
  handleImpossibleOddsStrike,
  modifyRevenantRechargeDuration,
  observeRevenantEvent
} from '#gw2/professions/revenant/core/traits/index.js';
import {
  advanceRevenantSpearState,
  handleAbyssalRazeRechargeReduction,
  handleCrushingAbyssGain,
  observeRevenantSpearEvent
} from '#gw2/professions/revenant/core/mechanics/crushing-abyss.js';
import { handleCrushingAbyssWeaponSwap } from '#gw2/professions/revenant/core/execution/spear.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

/**
 * Pays the skill's Energy cost and captures weapon state at cast start.
 */
function onCastStart(context: RevenantCastContext, skill: RevenantSkill): void {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

/**
 * Commits completion-gated Core weapon mechanics.
 */
function onCastComplete(context: RevenantCastContext, skill: RevenantSkill): void {
  completeRevenantFollowup(context, skill);
  completeRevenantWeaponCast(context, skill);
}

function advance(context: RevenantSchedulerContext, time: number): void {
  advanceRevenantEnergy(context, time);
  advanceRevenantSpearState(context, time);
}

function onEventScheduled(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  observeRevenantWeaponEvent(context, event);
  observeRevenantSpearEvent(context, event);
  observeRevenantEvent(context, event);
}

/**
 * Revenant availability and recharge-duration rules; cast speed uses shared policy.
 */
export const revenantCastRules = Object.freeze({
  availability: {
    id: 'revenant.availability',
    order: 10,
    handler: revenantCastAvailability
  },
  modifyRechargeDuration: modifyRevenantRechargeDuration
});

/**
 * Revenant scheduler lifecycle hooks and typed task dispatch table.
 */
export const revenantSchedulerHooks = Object.freeze({
  advance,
  prepareEvent: {
    id: 'revenant.hitbox',
    order: 10,
    handler: prepareRevenantHitboxEvent
  },
  onCastStart,
  onCastComplete,
  afterCast: afterRevenantCast,
  /**
   * Makes legend swap immediately available after a global cooldown reset.
   */
  onCooldownReset: (context: RevenantSchedulerContext): void => {
    professionCoreState(context).legendSwapReadyAt = context.state.time;
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    'revenant.blossoming-aura': handleBlossomingAura,
    'revenant.abyssal-raze-recharge': handleAbyssalRazeRechargeReduction,
    'revenant.crushing-abyss-gain': handleCrushingAbyssGain,
    'revenant.crushing-abyss-weapon-swap': handleCrushingAbyssWeaponSwap,
    'revenant.upkeep-pulse': handleRevenantUpkeepPulse,
    'revenant.imperial-guard-expire': expireImperialGuard,
    'revenant.impossible-odds-strike': handleImpossibleOddsStrike,
    'revenant.drop-the-hammer-reset': resetCoalescenceOfRuin
  })
});

import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { buffMatchesAudience, GW2_STANDARD_BOONS, sumActiveStacks } from '#gw2/platform/combat/state/boons.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { isDamagingCondition } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  boonActive,
  playerHealthFraction,
  targetConditionActive,
  targetHealthFraction,
  vulnerabilityStacks
} from '#gw2/platform/combat/query/runtime-query.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { readProfessionCoreState, readProfessionSpecializationState } from '#gw2/platform/engine/profession/state.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2Stats } from '#gw2/platform/equipment/types.js';
import type {
  RevenantConfig,
  RevenantCoreState,
  RevenantState,
  RevenantResolverContext,
  RevenantResolverEvent
} from '#gw2/professions/revenant/types.js';

export { snapshotRevenantState } from '#gw2/professions/revenant/state.js';

export interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
  readonly state?: {
    readonly profession?: Partial<RevenantState>;
  };
}

function revenantRuntimeState(context: RevenantModifierContext): object | undefined {
  return context.runtime?.profession ?? context.state?.profession;
}

export function revenantRuntimeCoreState(context: RevenantModifierContext): Partial<RevenantCoreState> {
  return readProfessionCoreState<RevenantCoreState>(revenantRuntimeState(context));
}

export function revenantRuntimeSpecializationState(
  context: RevenantModifierContext,
  expectedKind: string
): Partial<RevenantState> {
  return readProfessionSpecializationState<RevenantState>(revenantRuntimeState(context), expectedKind) || {};
}

export function revenantTimedBuff(context: RevenantModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

/** Life steal bypasses ordinary strike modifiers; expose its Core bonus for specialization composition. */
export function revenantLifeSiphonBonus(context: RevenantResolverContext, event: RevenantResolverEvent): number | null {
  const flatStrike = [event.flatDamage, event.flatStrikeBase, event.flatStrikePowerCoeff].some(Number.isFinite);
  if (!flatStrike || (!event.lifeSiphon && !/siphon/i.test(`${event.name || ''} ${event.skillName || ''}`)))
    return null;
  return hasTrait(context.config, TRAIT.FEROCIOUS_AGGRESSION) &&
    boonActive({ config: context.config, runtime: context, time: event.at, event }, 'fury')
    ? 0.1
    : 0;
}

/** Applies Fury's life-steal bonus to Core and elite specializations without using ordinary strike scaling. */
export function modifyRevenantLifeSiphon(context: RevenantResolverContext, event: RevenantResolverEvent) {
  const bonus = revenantLifeSiphonBonus(context, event);
  if (bonus == null) return;
  return { flatStrikeMultiplier: Number(event.flatStrikeMultiplier ?? 1) * (1 + bonus) };
}

function activeOffhand(context: RevenantModifierContext): boolean {
  const set = Number(context.runtime?.activeWeaponSet || 1);
  return Boolean(gw2ConfiguredWeaponSet(context.config, set)[1]);
}

function targetHasDefensiveBoon(context: RevenantModifierContext): boolean {
  const boons = context.config?.target?.boons || {};
  return Boolean(
    (boons as Record<string, boolean | number>).stability || (boons as Record<string, boolean | number>).protection
  );
}

function periodicAssassinsPresence(context: RevenantModifierContext): boolean {
  if (!hasTrait(context, TRAIT.ASSASSINS_PRESENCE)) return false;
  const start = Number(context.runtime?.combatStartTime ?? context.runtime?.firstHitTime ?? context.time);
  return Math.max(0, context.time - start) % 10 < 3;
}

// Count distinct self-affecting boons active at the query time for Revenant
// modifiers that scale with boon variety.
export function revenantActiveBoonCount(context: RevenantModifierContext): number {
  return GW2_STANDARD_BOONS.filter((boon) => boonActive(context, boon)).length;
}

export const revenantCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.ferocious-aggression',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // Grant the bonus only while permanent or simulated Fury affects the player.
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION) &&
      boonActive(context, 'fury')
  },
  {
    id: 'revenant.rising-tide',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.RISING_TIDE) &&
      playerHealthFraction(context) > 0.75
  },
  {
    id: 'revenant.acolyte-of-torment',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      context.condition === 'Torment' &&
      hasTrait(context, TRAIT.ACOLYTE_OF_TORMENT)
  },
  {
    id: 'revenant.dwarven-battle-training',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.DWARVEN_BATTLE_TRAINING) &&
      targetConditionActive(context, 'Weakness')
  },
  {
    id: 'revenant.vicious-reprisal',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.VICIOUS_REPRISAL) &&
      boonActive(context, 'resolution')
  },
  {
    id: 'revenant.destructive-impulses',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.DESTRUCTIVE_IMPULSES)
  },
  {
    id: 'revenant.unsuspecting-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.UNSUSPECTING_STRIKES) &&
      targetHealthFraction(context) > 0.8
  },
  {
    id: 'revenant.targeted-destruction',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) => 1 + vulnerabilityStacks(context) * 0.005,
    when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && hasTrait(context, TRAIT.TARGETED_DESTRUCTION)
  },
  {
    id: 'revenant.brutality',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BRUTALITY) &&
      targetHasDefensiveBoon(context)
  },
  {
    id: 'revenant.swift-termination',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.SWIFT_TERMINATION) &&
      targetHealthFraction(context) < 0.5
  }
]);

export function compileRevenantModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

function modifyCoreCriticalChance(context: RevenantModifierContext, chance: number): number {
  return hasTrait(context, TRAIT.ROILING_MISTS) && (boonActive(context, 'fury') || periodicAssassinsPresence(context))
    ? chance + 0.25
    : chance;
}

// Apply Revenant's condition- and skill-specific base duration modifiers before
// shared Expertise scaling.
function modifyCoreConditionDuration(context: RevenantModifierContext, duration: number): number {
  let modified = duration;
  if (hasTrait(context, TRAIT.PACT_OF_PAIN) && !professionStaticRulesApplied(context.config)) {
    modified += 0.15;
  }

  if (
    isDamagingCondition(context.condition) &&
    hasTrait(context, TRAIT.YEARNING_EMPOWERMENT) &&
    !professionStaticRulesApplied(context.config)
  ) {
    modified += 0.1;
  }

  return modified;
}

// Reconcile build-time Revenant attributes with live legend, upkeep, and trait
// state without double-applying static bonuses.
function modifyCoreAttributes(context: RevenantModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified = { ...attributes } as Record<string, number>;
  if (hasTrait(context, TRAIT.NOTORIETY)) {
    const baseMight = Math.max(0, Math.min(25, Number(context.config?.boons?.might || 0)));
    // Notoriety converts only the player's Might; retain explicit zero stacks and the remaining configured cap.
    const dynamicMight = sumActiveStacks(
      context.runtime?.boons?.get('might') || [],
      (application) =>
        buffMatchesAudience(application, 'all') &&
        application.at <= context.time &&
        application.expiresAt > context.time,
      (application) => Number(application.stacks ?? 1),
      25 - baseMight
    );
    const might = baseMight + dynamicMight;
    modified.power = Number(modified.power || 0) + might * 10;
    modified.conditionDamage = Number(modified.conditionDamage || 0) - might * 10;
  }

  return modified;
}

export const revenantCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyCoreAttributes,
  modifyCriticalChance: modifyCoreCriticalChance,
  modifyConditionDuration: modifyCoreConditionDuration,
  modifierRules: revenantCoreModifierRules,
  compileModifierRules: compileRevenantModifierRules
});
