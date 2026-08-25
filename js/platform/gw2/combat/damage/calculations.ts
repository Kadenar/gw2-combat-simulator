// Stateless GW2 damage formulas used by timestamp-aware runtime resolution.

import { clamp } from '../numeric.js';
import { criticalChanceFractionFromPrecision, criticalDamageMultiplierFromFerocity } from './stat-scaling.js';

const TARGET_ARMOR = 2597;

// GW2 strike damage formula before critical hits and outgoing modifiers.
/** Calculates pre-critical strike damage from coefficient, weapon strength, power, and armor. */
export function strikeDamage(coefficient: number, weaponStrength: number, power: number, armor = TARGET_ARMOR): number {
  return (coefficient * weaponStrength * power) / armor;
}

// Percentage-form API used by attribute tables (e.g. 50 chance, 200 damage).
/** Calculates the expected critical multiplier from percentage-form chance and damage. */
export function expectedCritMultiplier(critChancePct: number, critDamagePct: number): number {
  const cc = Math.min(critChancePct / 100, 1);
  const cd = critDamagePct / 100;
  return 1 + cc * (cd - 1);
}

/** Converts precision to a clamped critical-hit chance fraction. */
export function criticalChance(precision: number): number {
  // Fraction-form API used by the resolver. Precision below the level-80
  // baseline is clamped rather than producing a negative chance.
  return clamp(criticalChanceFractionFromPrecision(Number(precision)), 0, 1);
}

/** Converts ferocity to a critical-damage multiplier. */
export function criticalDamageMultiplier(ferocity: number): number {
  // Returns a factor (1.5 means 150%), unlike the percentage-form helper above.
  return criticalDamageMultiplierFromFerocity(Math.max(0, Number(ferocity)));
}

/** Calculates the expected critical multiplier from fraction-form chance and damage. */
export function expectedCriticalMultiplier(chance: number, multiplier: number): number {
  // Fraction-form companion to expectedCritMultiplier.
  const normalizedChance = clamp(Number(chance), 0, 1);
  return 1 + normalizedChance * (Number(multiplier) - 1);
}
