import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  thiefEventSkill,
  thiefPlayerEvent,
  thiefRuntimeSpecializationState,
} from "../../core/rules.js";
import { deadeyeCastAvailability } from "./availability.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../../platform/gw2/types.js";

function activeBoonCount(context: Gw2ModifierContext): number {
  return Object.values(context.config?.boons || {}).filter(value =>
    typeof value === "number" ? value > 0 : Boolean(value)).length;
}

export const deadeyeModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: "thief.iron-sight",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.IRON_SIGHT)
      && Boolean(
        thiefRuntimeSpecializationState(context, "Deadeye").markedTargetId,
      ),
  },
  {
    id: "thief.premeditation",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => activeBoonCount(context) * 0.01,
    when: context =>
      thiefPlayerEvent(context) && hasTrait(context, TRAIT.PREMEDITATION),
  },
  {
    id: "thief.malicious-stealth-attack",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context =>
      Math.max(
        0,
        Number(
          thiefRuntimeSpecializationState(context, "Deadeye").malice || 0,
        ),
      ) * 0.15,
    when: context =>
      thiefPlayerEvent(context)
      && Boolean(thiefEventSkill(context)?.malicious)
      && thiefEventSkill(context)?.name !== "Malicious Ashen Assault",
  },
]);

export const deadeyeAttributeRules = Object.freeze({
  modifierRules: deadeyeModifierRules,
});

export const deadeyeCastRules = Object.freeze({
  availability: {
    id: "thief.deadeye-availability",
    order: 20,
    handler: deadeyeCastAvailability,
  },
});
