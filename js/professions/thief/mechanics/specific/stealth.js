import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function beginStealthAttack(context) {
  const state = context.state.profession;
  if (hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
    gainThiefInitiative(context, 1, context.start, "leave-stealth");
  }
  state.stealthUntil = context.start;
  state.revealedUntil = context.start + 3;
  emitThiefState(context, context.start, "stealth-attack");
}

export function completeStealthAttack(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  if (skill.malicious) {
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    emitThiefState(context, at, "malice-spent");
  }
  if (hasThiefTrait(context.config, TRAIT.HIDDEN_THIEF)) {
    emitThiefCondition(context, {
      at,
      condition: "Weakness",
      duration: 5,
      sourceId: TRAIT.HIDDEN_THIEF,
      name: "Hidden Thief — Weakness",
    });
  }
  if (hasThiefTrait(context.config, TRAIT.SUNDERING_SHADE)) {
    emitThiefCondition(context, {
      at,
      condition: "Vulnerability",
      duration: 8,
      stacks: 5,
      sourceId: TRAIT.SUNDERING_SHADE,
      name: "Sundering Shade — Vulnerability",
    });
  }
}
