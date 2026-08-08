import { specterState } from "./state.js";
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
import { gw2AlliedPlayerAssumptions } from "../../../../platform/gw2/allied-players.js";
import type {
  ThiefCastContext,
  ThiefSchedulerContext,
  ThiefSkill,
} from "../../types.js";

export function completeSiphon(context: ThiefCastContext): void {
  const state = specterState.from(context);
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

export function enterShadowShroud(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = specterState.from(context);
  const at = context.effectiveEnd;
  state.shadowShroudActive = true;
  state.shadowForceUpdatedAt = at;
  const alliedRecipients = Math.min(
    1,
    gw2AlliedPlayerAssumptions(context.config).count,
  );
  if (alliedRecipients > 0) {
    context.emit({
      type: "buff",
      at,
      source: "thief",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Enter Shadow Shroud - Barrier",
      kind: "barrier",
      duration: 5,
      stacks: 1,
      affectsSelf: false,
      recipients: "allies",
      recipientCount: alliedRecipients,
      maximumRecipients: alliedRecipients,
    });
    context.tasks.schedule({
      type: "thief.specter-dark-sentry",
      at,
      payload: { allyIndices: [1] },
    });
  }
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "enter-shadow-shroud");
}

export function exitShadowShroud(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const at = context.effectiveEnd;
  specterState.from(context).shadowShroudActive = false;
  emitThiefShroudSwap(context, skill, at);
  emitThiefState(context, at, "exit-shadow-shroud");
}

export function spendSpecterResources(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const cost = Number(skill.initiativeCost || 0);
  if (!(cost > 0)) return;
  const state = specterState.from(context);
  state.shadowForce = Math.min(
    state.maximumShadowForce,
    state.shadowForce + cost * SHADOW_FORCE_PER_INITIATIVE,
  );
  emitThiefState(context, context.start, "shadow-force");
}

export function advanceSpecterResources(
  context: ThiefSchedulerContext,
  target: number,
): void {
  const state = specterState.from(context);
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
