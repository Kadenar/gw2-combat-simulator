import { THIEF_TRAIT_IDS as TRAIT } from "../../data/ids.js";
import { hasThiefTrait } from "../../core/state.js";
import {
  emitThiefShroudSwap,
  emitThiefState,
} from "../../core/shared.js";
import {
  SHADOW_FORCE_DRAIN_FRACTION_PER_SECOND,
  SHADOW_FORCE_PER_INITIATIVE,
  SIPHON_AMPLIFIED_SHADOW_FORCE,
  SIPHON_BASE_SHADOW_FORCE,
} from "./mechanics.js";
import { completeStealWithStoredSkill } from "../../core/steal.js";

export function completeSiphon(context) {
  const state = context.state.profession;
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + (
      hasThiefTrait(context.config, TRAIT.AMPLIFIED_SIPHONING)
        ? SIPHON_AMPLIFIED_SHADOW_FORCE
        : SIPHON_BASE_SHADOW_FORCE
    ),
  );
  completeStealWithStoredSkill(context, null);
}

export function enterShadowShroud(context, skill) {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.shadowShroudActive = true;
  state.shadowForceUpdatedAt = at;
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "enter-shadow-shroud");
}

export function exitShadowShroud(context, skill) {
  const at = context.effectiveEnd;
  context.state.profession.shadowShroudActive = false;
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "exit-shadow-shroud");
}

export function spendSpecterResources(context, skill) {
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;
  const state = context.state.profession;
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + cost * SHADOW_FORCE_PER_INITIATIVE,
  );
  emitThiefState(context, context.start, "shadow-force");
}

export function advanceSpecterResources(context, target) {
  const state = context.state.profession;
  const shadowFrom = Number(state.shadowForceUpdatedAt || 0);
  if (target > shadowFrom && state.shadowShroudActive) {
    state.shadowForce = Math.max(
      0,
      state.shadowForce
        - (target - shadowFrom)
        * state.maximumShadowForce
        * SHADOW_FORCE_DRAIN_FRACTION_PER_SECOND,
    );
    if (state.shadowForce === 0) {
      state.shadowShroudActive = false;
      emitThiefShroudSwap(context, {
        id: "thief.shadow-shroud-depleted",
        name: "Exit Shadow Shroud",
      }, target);
      emitThiefState(context, target, "shadow-shroud-depleted");
    }
  }
  state.shadowForceUpdatedAt = target;
  emitThiefState(context, target, "resources");
}
