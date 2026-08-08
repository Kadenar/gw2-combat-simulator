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
import { daredevilCastAvailability } from "./availability.js";

export const daredevilModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.weakening-strikes",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.WEAKENING_STRIKES)
      && thiefTargetHasCondition(context, "Weakness"),
  },
  {
    id: "thief.havoc-specialist",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.HAVOC_SPECIALIST)
      && Number(thiefRuntimeState(context).endurance || 0)
        < Number(thiefRuntimeState(context).maximumEndurance || 100),
  },
  {
    id: "thief.bounding-dodger",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.15,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.BOUNDING_DODGER)
      && Number(
        thiefRuntimeSpecializationState(context, "Daredevil")
          .boundingDamageUntil || 0,
      )
        > context.time,
  },
  {
    id: "thief.lotus-training",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.15,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.LOTUS_TRAINING)
      && Number(
        thiefRuntimeSpecializationState(context, "Daredevil")
          .lotusConditionDamageUntil || 0,
      ) > context.time,
  },
]);

export const daredevilAttributeRules = Object.freeze({
  modifierRules: daredevilModifierRules,
});

export const daredevilCastRules = Object.freeze({
  availability: {
    id: "thief.daredevil-availability",
    order: 20,
    handler: daredevilCastAvailability,
  },
});
