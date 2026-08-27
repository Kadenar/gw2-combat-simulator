import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { gw2ConfiguredWeaponSet } from '../../../../platform/equipment/weapons/loadout.js';
/**
 * @fileoverview Composes Revenant Energy, weapon, trait, and upkeep
 * callbacks into the cast and scheduler contracts used by the shared engine.
 */

import { revenantCastAvailability } from './availability.js';
import { advanceRevenantEnergy } from './energy.js';
import { spendRevenantEnergy } from '../energy.js';
import { prepareRevenantHitboxEvent } from './events.js';
import { handleRevenantUpkeepPulse } from './upkeep.js';
import { completeRevenantFollowup } from './actions.js';
import {
  beginRevenantWeaponCast,
  completeRevenantWeaponCast,
  expireImperialGuard,
  observeRevenantWeaponEvent,
  resetCoalescenceOfRuin,
  updateRevenantWeaponState
} from './weapon-state.js';
import {
  afterRevenantCast,
  handleImpossibleOddsStrike,
  initializeRevenantTraits,
  modifyRevenantCastDuration,
  modifyRevenantRechargeDuration,
  observeRevenantEvent
} from './traits.js';
import {
  advanceRevenantSpearState,
  handleAbyssalRazeRechargeReduction,
  handleCrushingAbyssGain,
  handleCrushingAbyssWeaponSwap,
  observeRevenantSpearEvent
} from './spear.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../types.js';

/**
 * Pays the skill's Energy cost and captures weapon state at cast start.
 *
 * @param {object} context Scheduler cast-start context.
 * @param {object} skill Skill beginning its cast.
 * @returns {void}
 */
function onCastStart(context: RevenantCastContext, skill: RevenantSkill): void {
  spendRevenantEnergy(context, skill);
  beginRevenantWeaponCast(context, skill);
}

/**
 * Commits completion-gated Core weapon mechanics.
 *
 * @param {object} context Scheduler cast-completion context.
 * @param {object} skill Completed skill.
 * @returns {void}
 */
function onCastComplete(context: RevenantCastContext, skill: RevenantSkill): void {
  completeRevenantFollowup(context, skill);
  completeRevenantWeaponCast(context, skill);
}

/**
 * Updates weapon transitions before applying general Revenant after-cast
 * trait reactions.
 *
 * @param {object} context Scheduler after-cast context.
 * @param {object} skill Completed or interrupted skill.
 * @returns {void}
 */
function afterCast(context: RevenantCastContext, skill: RevenantSkill): void {
  updateRevenantWeaponState(context, skill);
  afterRevenantCast(context, skill);
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
 * Revenant availability, cast-duration, and recharge-duration rules.
 */
export const revenantCastRules = Object.freeze({
  availability: {
    id: 'revenant.availability',
    order: 10,
    handler: revenantCastAvailability
  },
  modifyCastDuration: modifyRevenantCastDuration,
  modifyRechargeDuration: modifyRevenantRechargeDuration
});

/**
 * Revenant scheduler lifecycle hooks and typed task dispatch table.
 */
export const revenantSchedulerHooks = Object.freeze({
  initialize: initializeRevenantTraits,
  advance,
  prepareEvent: {
    id: 'revenant.hitbox',
    order: 10,
    handler: prepareRevenantHitboxEvent
  },
  onCastStart,
  onCastComplete,
  afterCast,
  /**
   * Makes legend swap immediately available after a global cooldown reset.
   *
   * @param {object} context Scheduler cooldown-reset context.
   * @returns {void}
   */
  onCooldownReset: (context: RevenantSchedulerContext): void => {
    professionCoreState(context).legendSwapReadyAt = context.state.time;
  },
  onEventScheduled,
  taskHandlers: Object.freeze({
    'revenant.abyssal-raze-recharge': handleAbyssalRazeRechargeReduction,
    'revenant.crushing-abyss-gain': handleCrushingAbyssGain,
    'revenant.crushing-abyss-weapon-swap': handleCrushingAbyssWeaponSwap,
    'revenant.upkeep-pulse': handleRevenantUpkeepPulse,
    'revenant.imperial-guard-expire': expireImperialGuard,
    'revenant.impossible-odds-strike': handleImpossibleOddsStrike,
    'revenant.drop-the-hammer-reset': resetCoalescenceOfRuin
  })
});

import { createModifierHooks, MODIFIER_TARGET } from '../../../../platform/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '../../../../platform/builds/attribute-provenance.js';
import { isStandardBoon } from '../../../../platform/combat/state/boons.js';
import { isGw2PlayerModifierEligibleEvent } from '../../../../platform/combat/state/event-ownership.js';
import { isDamagingCondition } from '../../../../platform/combat/state/targets.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import {
  playerHealthFraction,
  targetConditionActive,
  targetHealthFraction,
  vulnerabilityStacks
} from '../../../../platform/combat/query/runtime-query.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import {
  readProfessionCoreState,
  readProfessionSpecializationState
} from '../../../../platform/engine/profession/state.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/combat/modifiers/types.js';
import type { Gw2Stats } from '../../../../platform/equipment/types.js';
import type { RevenantConfig, RevenantCoreState, RevenantState } from '../types.js';

export { snapshotRevenantState } from '../state.js';

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
  const active = new Set(
    Object.entries(context.config?.boons || {})
      .filter(([, value]) => (typeof value === 'number' ? value > 0 : Boolean(value)))
      .map(([kind]) => kind.toLowerCase())
      .filter(isStandardBoon)
  );
  for (const [kind, applications] of context.runtime?.boons || []) {
    const normalized = String(kind).toLowerCase();
    if (
      isStandardBoon(normalized) &&
      applications.some((application) => application.at <= context.time && application.expiresAt > context.time)
    ) {
      active.add(normalized);
    }
  }

  return active.size;
}

export const revenantCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.ferocious-aggression',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION) &&
      Boolean(context.config?.boons?.fury)
  },
  {
    id: 'revenant.rising-tide',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.RISING_TIDE) &&
      playerHealthFraction(context) > 0.75
  },
  {
    id: 'revenant.acolyte-of-torment',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      context.condition === 'Torment' &&
      hasTrait(context, TRAIT.ACOLYTE_OF_TORMENT)
  },
  {
    id: 'revenant.dwarven-battle-training',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.DWARVEN_BATTLE_TRAINING) &&
      targetConditionActive(context, 'Weakness')
  },
  {
    id: 'revenant.vicious-reprisal',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.VICIOUS_REPRISAL) &&
      revenantTimedBuff(context, 'resolution')
  },
  {
    id: 'revenant.destructive-impulses',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.DESTRUCTIVE_IMPULSES)
  },
  {
    id: 'revenant.unsuspecting-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.UNSUSPECTING_STRIKES) &&
      targetHealthFraction(context) > 0.8
  },
  {
    id: 'revenant.targeted-destruction',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) => 1 + vulnerabilityStacks(context) * 0.005,
    when: (context) => isGw2PlayerModifierEligibleEvent(context.event) && hasTrait(context, TRAIT.TARGETED_DESTRUCTION)
  },
  {
    id: 'revenant.brutality',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.BRUTALITY) &&
      targetHasDefensiveBoon(context)
  },
  {
    id: 'revenant.swift-termination',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, TRAIT.SWIFT_TERMINATION) &&
      targetHealthFraction(context) < 0.5
  }
]);

export function compileRevenantModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

function modifyCoreCriticalChance(context: RevenantModifierContext, chance: number): number {
  return hasTrait(context, TRAIT.ROILING_MISTS) &&
    (revenantTimedBuff(context, 'fury') || periodicAssassinsPresence(context))
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
    const dynamicMight = Math.min(
      Math.max(0, 25 - baseMight),
      (context.runtime?.boons?.get('might') || [])
        .filter((application) => application.at <= context.time && application.expiresAt > context.time)
        .reduce((sum, application) => sum + Number(application.stacks || 1), 0)
    );
    const might = Math.min(25, baseMight + dynamicMight);
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
