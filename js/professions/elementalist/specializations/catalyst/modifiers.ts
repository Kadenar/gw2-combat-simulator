import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";
import { elementalistTimedBuffStacks } from "../../core/modifiers.js";

export const catalystModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "elementalist.relentless-fire",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: (context) =>
      elementalistTimedBuffStacks(context, "relentless fire", 1) > 0,
  },
]);
