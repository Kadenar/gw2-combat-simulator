import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { activeLethalTempo } from '#gw2/professions/guardian/specializations/willbender/mechanics/lethal-tempo.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

function lethalTempoStacks(context: Gw2ModifierContext): number {
  return activeLethalTempo(willbenderState.from(context), context.time);
}

const willbenderModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'guardian.willbender.lethal-tempo-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    // Lethal Tempo shares the outgoing additive bucket with equipment and other additive traits.
    operation: 'damage-additive',
    // Tyrant's Momentum raises strike bonus (5 % vs 2 %) to compensate for the shorter window.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.05
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      lethalTempoStacks(context) *
      (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
        ? parameters.tyrantsMomentumDamagePerStack
        : parameters.damagePerStack),
    order: 100
  },
  {
    id: 'guardian.willbender.lethal-tempo-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    // Use the same additive grouping for conditions so Bursting does not multiply Lethal Tempo.
    operation: 'damage-additive',
    // Condition bonus is identical (2 %) without Tyrant's Momentum; the trait adds 1 % here too.
    parameters: {
      damagePerStack: 0.02,
      tyrantsMomentumDamagePerStack: 0.03
    } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      lethalTempoStacks(context) *
      (hasTrait(context, GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM)
        ? parameters.tyrantsMomentumDamagePerStack
        : parameters.damagePerStack),
    order: 100
  },
  {
    id: 'guardian.willbender.power-for-power',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 3,
    order: 100,
    // willbenderFlames flag is set only on Willbender Flames pulse strikes (rules.ts handleWillbenderFlamePulse),
    // so this 3× multiplier never applies to normal weapon hits.
    when: (context) => Boolean(context.event?.willbenderFlames) && hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_FOR_POWER)
  }
]);

export const willbenderAttributeRules = Object.freeze({
  modifierRules: willbenderModifierRules
});
