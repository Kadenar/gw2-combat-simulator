import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';

const modifierParameters = (values: Record<string, number>): Readonly<Record<string, number>> => Object.freeze(values);

// Explicit Core orders keep moved trait multipliers between skill rules and elite multipliers.
export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.event-final-multiplier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ fallbackFactor: 1 }),
    factor: (context, _target, parameters) => Number(context.event?.multiplier ?? parameters.fallbackFactor),
    order: 1000
  }
]);

function compileMesmerModifierRules(rules: readonly Gw2ModifierRule[]): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context)
      }
    }
  });
}

export const mesmerCoreModifiers = Object.freeze({
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules
});
