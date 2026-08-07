import { antiquaryState } from "./state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";

function applyMistburnCharge(context, event, details) {
  if (
    event.actorType !== "player"
    || event.coefficient == null
    || event.skillId === ID.MISTBURN_MORTAR
  ) return;
  const state = antiquaryState.from(context);
  if (
    Number(state.mistburnCharges || 0) <= 0
    || Number(state.mistburnExpiresAt || 0) <= event.at
  ) return;
  state.mistburnCharges -= 1;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.MISTBURN_MORTAR,
    actorType: "player",
    skillId: ID.MISTBURN_MORTAR,
    skillName: "Mistburn Mortar",
    name: "Mistburn Mortar — Charged Strike",
    condition: "Burning",
    stacks: 1,
    duration: 1,
    triggeredBy: event.skillName,
  });
}

function applyMeticulousSunCrystal(context, event, details) {
  if (
    event.actorType !== "player"
    || event.skillId !== ID.ZEPHYRITE_SUN_CRYSTAL
    || event.coefficient == null
    || !hasThiefTrait(context.config, TRAIT.METICULOUS_CUSTODIAN)
  ) return;
  details.applyCondition?.(context, {
    type: "condition",
    at: event.at,
    source: "thief",
    sourceId: ID.ZEPHYRITE_SUN_CRYSTAL,
    actorType: "player",
    skillId: ID.ZEPHYRITE_SUN_CRYSTAL,
    skillName: "Zephyrite Sun Crystal",
    name: "Zephyrite Sun Crystal - Meticulous Burning",
    condition: "Burning",
    stacks: 1,
    duration: 5,
  });
}

function applyAntiquaryDamageReactions(context, event, details) {
  applyMeticulousSunCrystal(context, event, details);
  applyMistburnCharge(context, event, details);
}

export const antiquaryResolverEventReactions = Object.freeze({
  damage: applyAntiquaryDamageReactions,
});
