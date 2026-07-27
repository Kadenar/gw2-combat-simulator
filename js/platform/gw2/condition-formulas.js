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
    activationScaling: 0.0325,
  }),
  // Both names are accepted because older skill data used "Poison".
  Poisoned: Object.freeze({ base: 33.5, scaling: 0.06 }),
  Poison: Object.freeze({ base: 33.5, scaling: 0.06 }),
  Torment: Object.freeze({
    base: 22,
    scaling: 0.06,
    stationaryBase: 31.8,
    stationaryScaling: 0.09,
  }),
});

/**
 * Returns one stack's one-second tick before duration and damage modifiers.
 * Torment defaults to its stationary-target formula; pass stationary: false
 * for the moving-target formula.
 */
export function conditionTickDamage(condition, conditionDamage = 0, options = {}) {
  const formula = CONDITION_FORMULAS[condition];
  if (!formula) return 0;
  if (condition === "Torment" && options.stationary !== false) {
    return formula.stationaryBase
      + formula.stationaryScaling * Math.max(0, Number(conditionDamage));
  }
  return formula.base + formula.scaling * Math.max(0, Number(conditionDamage));
}
