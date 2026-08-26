import { professionCoreState } from '../../../platform/engine/profession/state.js';
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

import { createModifierHooks, MODIFIER_TARGET } from '../../../platform/gw2/combat/modifiers/rules.js';
import { professionStaticRulesApplied } from '../../../platform/gw2/builds/attribute-provenance.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import {
  playerHealthFraction,
  targetHealthFraction,
  vulnerabilityStacks
} from '../../../platform/gw2/combat/query/runtime-query.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '../data/ids.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../platform/gw2/combat/modifiers/types.js';
import type { Gw2Stats } from '../../../platform/gw2/equipment/types.js';
import type { RevenantConfig, RevenantCoreState, RevenantRuntimeState, RevenantState } from '../types.js';

export { snapshotRevenantState } from '../state.js';

export interface RevenantModifierContext extends Gw2ModifierContext {
  readonly config?: RevenantConfig;
  readonly state?: {
    readonly profession?: Partial<RevenantState>;
  };
}

export function revenantPlayer(context: RevenantModifierContext): boolean {
  return context.event?.actorType !== 'summon';
}

function revenantRuntimeState(context: RevenantModifierContext): Partial<RevenantState> | RevenantRuntimeState {
  return (context.runtime?.profession ?? context.state?.profession ?? {}) as
    Partial<RevenantState> | RevenantRuntimeState;
}

export function revenantRuntimeCoreState(context: RevenantModifierContext): Partial<RevenantCoreState> {
  const state = revenantRuntimeState(context);
  return 'core' in state && state.core ? state.core : (state as Partial<RevenantCoreState>);
}

export function revenantRuntimeSpecializationState(context: RevenantModifierContext): Partial<RevenantState> {
  const state = revenantRuntimeState(context);
  return 'specialization' in state && state.specialization?.state
    ? (state.specialization.state as Partial<RevenantState>)
    : (state as Partial<RevenantState>);
}

export function revenantTimedBuff(context: RevenantModifierContext, kind: string): boolean {
  if (context.config?.boons?.[kind]) return true;
  return (context.runtime?.boons?.get(kind) || []).some(
    (application) => application.at <= context.time && application.expiresAt > context.time
  );
}

export function revenantTargetHealthFraction(context: RevenantModifierContext): number {
  return targetHealthFraction(context);
}

export function revenantTargetHasCondition(context: RevenantModifierContext, condition: string): boolean {
  return Boolean(context.query?.targetHasCondition(condition, context.time, context.runtime));
}

export function revenantTargetVulnerability(context: RevenantModifierContext): number {
  return vulnerabilityStacks(context);
}

function activeOffhand(context: RevenantModifierContext): boolean {
  const set = Number(context.runtime?.activeWeaponSet || 1);
  return Boolean(set === 2 ? context.config?.weaponSet2Secondary : context.config?.secondaryWeapon);
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

const DAMAGING_CONDITIONS = new Set(['Bleeding', 'Burning', 'Confusion', 'Poisoned', 'Torment']);

// Count distinct self-affecting boons active at the query time for Revenant
// modifiers that scale with boon variety.
export function revenantActiveBoonCount(context: RevenantModifierContext): number {
  const allowed = new Set([
    'aegis',
    'alacrity',
    'fury',
    'might',
    'protection',
    'quickness',
    'regeneration',
    'resistance',
    'resolution',
    'stability',
    'swiftness',
    'vigor'
  ]);
  const active = new Set(
    Object.entries(context.config?.boons || {})
      .filter(([, value]) => (typeof value === 'number' ? value > 0 : Boolean(value)))
      .map(([kind]) => kind.toLowerCase())
      .filter((kind) => allowed.has(kind))
  );
  for (const [kind, applications] of context.runtime?.boons || []) {
    const normalized = String(kind).toLowerCase();
    if (
      allowed.has(normalized) &&
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
      revenantPlayer(context) && hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION) && Boolean(context.config?.boons?.fury)
  },
  {
    id: 'revenant.rising-tide',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      revenantPlayer(context) && hasTrait(context, TRAIT.RISING_TIDE) && playerHealthFraction(context) > 0.75
  },
  {
    id: 'revenant.acolyte-of-torment',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      revenantPlayer(context) && context.condition === 'Torment' && hasTrait(context, TRAIT.ACOLYTE_OF_TORMENT)
  },
  {
    id: 'revenant.dwarven-battle-training',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.DWARVEN_BATTLE_TRAINING) &&
      revenantTargetHasCondition(context, 'Weakness')
  },
  {
    id: 'revenant.vicious-reprisal',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      revenantPlayer(context) && hasTrait(context, TRAIT.VICIOUS_REPRISAL) && revenantTimedBuff(context, 'resolution')
  },
  {
    id: 'revenant.destructive-impulses',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: (context) => (activeOffhand(context) ? 0.075 : 0.05),
    when: (context) => revenantPlayer(context) && hasTrait(context, TRAIT.DESTRUCTIVE_IMPULSES)
  },
  {
    id: 'revenant.unsuspecting-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.UNSUSPECTING_STRIKES) &&
      revenantTargetHealthFraction(context) > 0.8
  },
  {
    id: 'revenant.targeted-destruction',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: (context) => 1 + revenantTargetVulnerability(context) * 0.005,
    when: (context) => revenantPlayer(context) && hasTrait(context, TRAIT.TARGETED_DESTRUCTION)
  },
  {
    id: 'revenant.brutality',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'multiply',
    factor: 1.15,
    when: (context) => revenantPlayer(context) && hasTrait(context, TRAIT.BRUTALITY) && targetHasDefensiveBoon(context)
  },
  {
    id: 'revenant.swift-termination',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    when: (context) =>
      revenantPlayer(context) &&
      hasTrait(context, TRAIT.SWIFT_TERMINATION) &&
      revenantTargetHealthFraction(context) < 0.5
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
    DAMAGING_CONDITIONS.has(String(context.condition || '')) &&
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
