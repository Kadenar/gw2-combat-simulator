import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  holosmithEventMetadata,
  holosmithEventStrikeFactor
} from '#gw2/professions/engineer/specializations/holosmith/mechanics/heat-tiers.js';

/** Applies an authored skill factor before ordinary condition-duration bonuses are capped. */
function modifyHolosmithConditionBaseDuration(context: Gw2ModifierContext, multiplier: number): number {
  const factor = holosmithEventMetadata(context.event).holosmithConditionBaseDurationFactor ?? 1;
  return multiplier * (Number.isFinite(factor) ? Math.max(0, factor) : 1);
}

/** Defines Holosmith's heat- and trait-sensitive packet modifier rules. */
export const holosmithModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'engineer.enhanced-capacity-damage-tier',
    // Skill heat factors follow Core's Flame Jet and the registered Holosmith trait modifiers.
    order: 1,
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
