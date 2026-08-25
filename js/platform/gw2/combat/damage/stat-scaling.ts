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
