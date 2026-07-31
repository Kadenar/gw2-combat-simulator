import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { timedStacks } from "../../core/attribute-rules.js";
import { initializeMirageRuntime } from "./runtime.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";

export const mirageModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "mesmer.nomads-endurance",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.1 : 0.05,
    when: (context) =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE) &&
      Boolean(context.timeline?.vigorActiveAt(context.time)),
  },
  {
    id: "mesmer.phantom-pain",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context, target) =>
      timedStacks(context, "phantom-pain", 10, 4) *
      (target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.05 : 0.0625),
  },
]);

export const mirageAttributeRules = Object.freeze({
  modifierRules: mirageModifierRules,
});

export const mirageSchedulerHooks = Object.freeze({
  initialize: initializeMirageRuntime,
});
