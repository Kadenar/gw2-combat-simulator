import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  thiefPlayerEvent,
  thiefRuntimeState,
  thiefRuntimeSpecializationState,
  thiefTargetHasCondition,
} from "../../core/rules.js";
import type { Gw2ModifierRule } from "../../../../platform/gw2/types.js";

export const daredevilModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.weakening-strikes",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.WEAKENING_STRIKES)
      && thiefTargetHasCondition(context, "Weakness"),
  },
  {
    id: "thief.havoc-specialist",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => {
      const state = thiefRuntimeState(context);
      const maximum = Math.max(1, Number(state.maximumEndurance || 100));
      return (1 - Number(state.endurance || 0) / maximum) * 0.15;
    },
    when: context =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.HAVOC_SPECIALIST),
  },
  {
    id: "thief.bounding-dodger",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.BOUNDING_DODGER)
      && Number(
        thiefRuntimeSpecializationState(context, "Daredevil")
          .boundingDamageUntil || 0,
      )
        > context.time,
  },
]);

export const daredevilAttributeRules = Object.freeze({
  modifierRules: daredevilModifierRules,
});
