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
