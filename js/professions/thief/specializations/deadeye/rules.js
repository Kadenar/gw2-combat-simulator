import { MODIFIER_TARGET } from "../../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import {
  thiefEventSkill,
  thiefPlayerEvent,
  thiefRuntimeState,
} from "../../core/rules.js";
import { deadeyeCastAvailability } from "./availability.js";

function activeBoonCount(context) {
  return Object.values(context.config?.boons || {}).filter(value =>
    typeof value === "number" ? value > 0 : Boolean(value)).length;
}

export const deadeyeModifierRules = Object.freeze([
  {
    id: "thief.iron-sight",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      thiefPlayerEvent(context)
      && hasTrait(context, TRAIT.IRON_SIGHT)
      && Boolean(thiefRuntimeState(context).markedTargetId),
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
      Math.max(0, Number(thiefRuntimeState(context).malice || 0)) * 0.15,
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
