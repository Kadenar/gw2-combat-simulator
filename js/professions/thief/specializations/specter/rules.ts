import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { thiefPlayerEvent } from "../../core/rules.js";
import { specterCastAvailability } from "./availability.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";

export const specterModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.strength-of-shadows",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.2,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS)
      && context.event?.condition === "Torment",
  },
]);

export const specterAttributeRules = Object.freeze({
  modifierRules: specterModifierRules,
});

export const specterCastRules = Object.freeze({
  availability: {
    id: "thief.specter-availability",
    order: 20,
    handler: specterCastAvailability,
  },
});
