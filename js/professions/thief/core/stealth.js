import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";

export function beginStealthAttack(context, skill) {
  const state = context.state.profession;
  const stealthed =
    state.stealthUntil > context.start
    && state.revealedUntil <= context.start;
  if (
    !stealthed
    && Number(state.stealthAttackCharges || 0) > 0
    && Number(state.stealthAttackExpiresAt || 0) > context.start
  ) {
    state.stealthAttackCharges -= 1;
  }
  if (
    stealthed
    && hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)
  ) {
    gainThiefInitiative(context, 1, context.start, "leave-stealth");
  }
  if (stealthed && hasThiefTrait(context.config, TRAIT.LEECHING_VENOMS)) {
    state.spiderVenomCharges = Math.min(
      6,
      Number(state.spiderVenomCharges || 0) + 3,
    );
    state.spiderVenomExpiresAt = context.start + 24;
    state.spiderVenomGeneration += 1;
  }
  state.stealthUntil = context.start;
  if (!skill?.preservesStealth) {
    state.revealedUntil = context.start + 3;
  }
  emitThiefState(context, context.start, "stealth-attack");
}

export function completeStealthAttack(context, skill) {
  const at = context.effectiveEnd;
  if (hasThiefTrait(context.config, TRAIT.SUNDERING_SHADE)) {
    emitThiefCondition(context, {
      at,
      condition: "Vulnerability",
      duration: 5,
      stacks: 10,
      sourceId: TRAIT.SUNDERING_SHADE,
      name: "Sundering Shade — Vulnerability",
    });
  }
}
