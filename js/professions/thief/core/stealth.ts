import { professionCoreState } from "../../../platform/engine/profession.js";
import { THIEF_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasThiefTrait } from "./state.js";
import {
  emitThiefCondition,
  emitThiefState,
  gainThiefInitiative,
} from "./shared.js";
import type {
  AntiquaryState,
  ThiefCastContext,
  ThiefCoreState,
  ThiefSkill,
} from "../types.js";

export function beginStealthAttack(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = professionCoreState(context);
  const specialization = context.state.profession.specialization;
  const specializationState = specialization.state as Partial<AntiquaryState>;
  const stealthAttackState: Partial<AntiquaryState> = Object.hasOwn(
    specializationState,
    "stealthAttackCharges",
  )
    ? specializationState
    : (state as ThiefCoreState & Partial<AntiquaryState>);
  const stealthed =
    state.stealthUntil > context.start && state.revealedUntil <= context.start;
  if (
    !stealthed &&
    Number(stealthAttackState.stealthAttackCharges || 0) > 0 &&
    Number(stealthAttackState.stealthAttackExpiresAt || 0) > context.start
  ) {
    stealthAttackState.stealthAttackCharges =
      Number(stealthAttackState.stealthAttackCharges || 0) - 1;
  }
  if (stealthed && hasThiefTrait(context.config, TRAIT.SHADOWS_REJUVENATION)) {
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

export function completeStealthAttack(
  context: ThiefCastContext,
  _skill: ThiefSkill,
): void {
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
