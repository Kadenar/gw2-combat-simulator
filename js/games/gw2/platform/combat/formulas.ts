import { clamp } from '#gw2/platform/combat/numeric.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import type { Gw2Stats } from '#gw2/platform/equipment/types.js';

// Stateless GW2 damage formulas used by timestamp-aware runtime resolution.

const TARGET_ARMOR = 2597;

// GW2 strike damage formula before critical hits and outgoing modifiers.
/** Calculates pre-critical strike damage from coefficient, weapon strength, power, and armor. */
export function strikeDamage(coefficient: number, weaponStrength: number, power: number, armor = TARGET_ARMOR): number {
  return (coefficient * weaponStrength * power) / armor;
}

/** Keeps critical chance as a fraction and critical damage as a factor through strike resolution. */
export function expectedCritMultiplier(chance: number, damage: number): number {
  return 1 + Math.min(chance, 1) * (damage - 1);
}

/** Converts precision to a clamped critical-hit chance fraction. */
export function criticalChance(precision: number): number {
  // Fraction-form API used by the resolver. Precision below the level-80
  // baseline is clamped rather than producing a negative chance.
  return clamp(criticalChanceFractionFromPrecision(Number(precision)), 0, 1);
}

/** Converts ferocity to a critical-damage multiplier. */
export function criticalDamageMultiplier(ferocity: number): number {
  // Returns a factor (1.5 means 150%).
  return criticalDamageMultiplierFromFerocity(Math.max(0, Number(ferocity)));
}

// Values are damage per stack-second: base + scaling * Condition Damage.
// Confusion's activation terms are exposed for resolvers that model target
// actions separately from its passive tick.
export const CONDITION_FORMULAS = Object.freeze({
  Bleeding: Object.freeze({ base: 22, scaling: 0.06 }),
  Burning: Object.freeze({ base: 131, scaling: 0.155 }),
  Confusion: Object.freeze({
    base: 18.25,
    scaling: 0.05,
    activationBase: 16.24,
    activationScaling: 0.0325
  }),
  // Fear enters this formula only when a profession explicitly schedules it
  // as damaging; ordinary control-only fear events never enter this table.
  Fear: Object.freeze({ base: 444, scaling: 0.4 }),
  // Both names are accepted because older skill data used "Poison".
  Poisoned: Object.freeze({ base: 33.5, scaling: 0.06 }),
  Poison: Object.freeze({ base: 33.5, scaling: 0.06 }),
  Torment: Object.freeze({
    base: 22,
    scaling: 0.06,
    stationaryBase: 31.8,
    stationaryScaling: 0.09
  })
});

const CONDITION_FORMULA_LOOKUP: Readonly<Record<string, ConditionFormula>> = CONDITION_FORMULAS;

/**
 * Returns one stack's one-second tick before duration and damage modifiers.
 * Torment defaults to its stationary-target formula; pass stationary: false
 * for the moving-target formula.
 */
export function conditionTickDamage(
  condition: string,
  conditionDamage = 0,
  options: { readonly stationary?: boolean } = {}
): number {
  const formula = CONDITION_FORMULA_LOOKUP[condition];
  if (!formula) return 0;
  if (condition === 'Torment' && options.stationary !== false) {
    return (
      Number(formula.stationaryBase || 0) +
      Number(formula.stationaryScaling || 0) * Math.max(0, Number(conditionDamage))
    );
  }

  return formula.base + formula.scaling * Math.max(0, Number(conditionDamage));
}

export interface ConditionFormula {
  readonly base: number;
  readonly scaling: number;
  readonly activationBase?: number;
  readonly activationScaling?: number;
  readonly stationaryBase?: number;
  readonly stationaryScaling?: number;
}

// Canonical level-80 stat scaling uses runtime fractions. Percentage-form
// constants are derived so display attributes cannot drift from combat rules.
const PERCENT_SCALE = 100;

export const LEVEL_80_BASE_PRECISION = 1000;
export const BASE_CRITICAL_CHANCE_FRACTION = 0.05;
export const PRECISION_PER_CRITICAL_CHANCE_FRACTION = 2100;

export const BASE_CRITICAL_DAMAGE_MULTIPLIER = 1.5;
export const FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER = 1500;

export const EXPERTISE_PER_CONDITION_DURATION_MULTIPLIER = 1500;

const ZERO_CRITICAL_CHANCE_PRECISION =
  LEVEL_80_BASE_PRECISION - BASE_CRITICAL_CHANCE_FRACTION * PRECISION_PER_CRITICAL_CHANCE_FRACTION;
const PRECISION_PER_CRITICAL_CHANCE_PERCENT = PRECISION_PER_CRITICAL_CHANCE_FRACTION / PERCENT_SCALE;
const BASE_CRITICAL_DAMAGE_PERCENT = BASE_CRITICAL_DAMAGE_MULTIPLIER * PERCENT_SCALE;
const FEROCITY_PER_CRITICAL_DAMAGE_PERCENT = FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER / PERCENT_SCALE;
const EXPERTISE_PER_CONDITION_DURATION_PERCENT = EXPERTISE_PER_CONDITION_DURATION_MULTIPLIER / PERCENT_SCALE;

// These helpers intentionally preserve each API's existing evaluation order.
// Caps, floors, and other policy remain with the caller.
/** Converts precision to critical chance in percentage-point form. */
export function criticalChancePercentFromPrecision(precision: number): number {
  return (precision - ZERO_CRITICAL_CHANCE_PRECISION) / PRECISION_PER_CRITICAL_CHANCE_PERCENT;
}

/** Converts precision to critical chance in fractional form. */
export function criticalChanceFractionFromPrecision(precision: number): number {
  return BASE_CRITICAL_CHANCE_FRACTION + (precision - LEVEL_80_BASE_PRECISION) / PRECISION_PER_CRITICAL_CHANCE_FRACTION;
}

/** Converts ferocity to critical damage in percentage-point form. */
export function criticalDamagePercentFromFerocity(ferocity: number): number {
  return BASE_CRITICAL_DAMAGE_PERCENT + ferocity / FEROCITY_PER_CRITICAL_DAMAGE_PERCENT;
}

/** Converts ferocity to a critical-damage multiplier. */
export function criticalDamageMultiplierFromFerocity(ferocity: number): number {
  return BASE_CRITICAL_DAMAGE_MULTIPLIER + ferocity / FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER;
}

/** Converts expertise to condition duration in percentage-point form. */
export function conditionDurationPercentFromExpertise(expertise: number): number {
  return expertise / EXPERTISE_PER_CONDITION_DURATION_PERCENT;
}

/** Converts expertise to condition duration in fractional form. */
export function conditionDurationFractionFromExpertise(expertise: number): number {
  return expertise / EXPERTISE_PER_CONDITION_DURATION_MULTIPLIER;
}

/** Calculates the capped duration multiplier for a condition. */
export function gw2ConditionDurationMultiplier(
  condition: string,
  stats: Gw2ResolvedStats | Gw2Stats,
  extraBonus = 0
): number {
  const bonus =
    conditionDurationFractionFromExpertise(Number(stats.expertise || 0)) +
    Number(stats.conditionDurationBonus || 0) / 100 +
    Number(stats.conditionDurationBonuses?.[condition] || 0) / 100 +
    Number(extraBonus || 0);
  // This helper models duration extensions only and enforces GW2's +100% cap.
  return clamp(1 + bonus, 1, 2);
}
