import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerSpecializationState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import {
  holosmithEventMetadata,
  holosmithEventStrikeFactor
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

/** Applies an authored skill factor before ordinary condition-duration bonuses are capped. */
function modifyHolosmithConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  const factor = Number(holosmithEventMetadata(context.event).holosmithConditionBaseDurationFactor ?? 1);
  return multiplier * (Number.isFinite(factor) ? Math.max(0, factor) : 1);
}

/** Defines Holosmith's heat- and trait-sensitive packet modifier rules. */
export const holosmithModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'engineer.lasers-edge',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      standardMaximum: 0.15,
      enhancedMaximum: 0.225,
      bonusPerHeat: 0.0015
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) => {
      const state = engineerSpecializationState(context, 'Holosmith');
      const maximum = hasTrait(context, TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT)
        ? parameters.enhancedMaximum
        : parameters.standardMaximum;
      return 1 + Math.min(maximum, Number(state.heat || 0) * parameters.bonusPerHeat);
    },
    when: (context) => {
      const state = engineerSpecializationState(context, 'Holosmith');
      return (
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.LASERS_EDGE) &&
        ((Boolean(state.photonForgeActive) && !state.overheated) ||
          (hasTrait(context, TRAIT.PHOTONIC_BLASTING_MODULE) &&
            Boolean(state.overheated) &&
            Number(state.heat || 0) > 0))
      );
    }
  },
  {
    id: 'engineer.solar-focusing-lens',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.SOLAR_FOCUSING_LENS) &&
      holosmithEventMetadata(context.event).solarFocusingLens === true
  },
  {
    id: 'engineer.enhanced-capacity-damage-tier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: { defaultFactor: 1 },
    // Heat-sensitive emitters own skill selection and tuning; this rule applies
    // either a delayed packet's captured factor or a direct packet's live profile tier.
    factor: (context, _target, parameters) =>
      holosmithEventStrikeFactor(context, context.event || {}, parameters.defaultFactor),
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) && holosmithEventStrikeFactor(context, context.event || {}) > 1
  }
]);

/** Exposes Holosmith condition-base-duration and packet modifier rules. */
export const holosmithModifiers = Object.freeze({
  modifyConditionBaseDuration: modifyHolosmithConditionBaseDuration,
  modifierRules: holosmithModifierRules
});
