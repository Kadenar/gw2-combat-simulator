import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { fencersFinesseFerocity, prepareFencersFinesse } from '#gw2/professions/mesmer/core/traits/dueling/index.js';

/** Apply live Fencer's Finesse stacks after ordinary declarations. */
export function applyMesmerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  return {
    ...attributes,
    ferocity: attributes.ferocity + fencersFinesseFerocity(context, prepareFencersFinesse(context))
  };
}

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
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules
});
