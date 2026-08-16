import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";
import {
  elementalistMightStacks,
  elementalistTimedBuffStacks,
} from "../../core/modifiers.js";

export const evokerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "elementalist.familiars-prowess-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: (context) => (hasTrait(context, "Familiar's Focus") ? 0.1 : 0.05),
    when: (context) =>
      context.config?.evokerElement === "Air" &&
      elementalistTimedBuffStacks(context, "familiar's-prowess", 1) > 0,
  },
  {
    id: "elementalist.familiars-prowess-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: (context) => (hasTrait(context, "Familiar's Focus") ? 0.1 : 0.05),
    when: (context) =>
      context.config?.evokerElement === "Fire" &&
      elementalistTimedBuffStacks(context, "familiar's-prowess", 1) > 0,
  },
  {
    id: "elementalist.enhanced-potency-air",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: (context) =>
      context.config?.evokerElement === "Air" &&
      hasTrait(context, "Enhanced Potency") &&
      Boolean(
        context.query?.furyActiveAt(
          context.time,
          context.runtime,
          context.event,
        ),
      ),
  },
  {
    id: "elementalist.zap",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.03,
    when: (context) =>
      context.config?.evokerElement === "Air" &&
      elementalistTimedBuffStacks(context, "zap buff", 1) > 0,
  },
]);

export function modifyEvokerAttributes(
  context: Gw2ModifierContext,
  attributes: SchedulerRecord,
): SchedulerRecord {
  const modified = { ...attributes };
  if (
    context.config?.evokerElement === "Air" &&
    Boolean(
      context.query?.furyActiveAt(context.time, context.runtime, context.event),
    )
  ) {
    modified.ferocity = Number(modified.ferocity || 0) + 75;
  }
  if (
    context.config?.evokerElement === "Fire" &&
    hasTrait(context, "Enhanced Potency")
  ) {
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      elementalistMightStacks(context) * 5;
  }
  return modified;
}
