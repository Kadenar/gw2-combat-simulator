import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import { galeshotState } from "./state.js";
import type {
  RangerCastContext,
  RangerSchedulerContext,
  RangerSkill,
} from "../../types.js";

export function advanceGaleshotArrows(
  context: RangerSchedulerContext,
  target: number,
): void {
  const state = galeshotState.from(context);
  if (target <= state.arrowsUpdatedAt) return;
  state.arrows = Math.min(
    state.maximumArrows,
    state.arrows + (target - state.arrowsUpdatedAt) / 5,
  );
  state.arrowsUpdatedAt = target;
}

export const galeshotSkillHandlers = Object.freeze({
  "ranger.cyclone-bow-enter": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      galeshotState.from(context).cycloneBowActive = true;
    },
  },
  "ranger.cyclone-bow-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      const state = galeshotState.from(context);
      state.cycloneBowActive = false;
      state.windForce = 0;
    },
  },
  "ranger.cyclone-bow-skill": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      const cost = Number(skill.arrowCost || 0);
      state.arrows = Math.max(0, state.arrows - cost);
      state.windForce =
        skill.id === ID.HAWKEYE ? 0 : Math.min(5, state.windForce + cost);
    },
  },
  "ranger.galeshot-arrows": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      const state = galeshotState.from(context);
      state.arrows = Math.min(
        state.maximumArrows,
        state.arrows + Number(skill.arrowsRestored || 0),
      );
    },
  },
});

export const galeshotSchedulerHooks = Object.freeze({
  advance: {
    id: "ranger.galeshot-arrows",
    order: 20,
    handler: advanceGaleshotArrows,
  },
});
