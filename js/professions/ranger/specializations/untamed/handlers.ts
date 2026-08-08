import { untamedState } from "./state.js";
import type { RangerCastContext } from "../../types.js";

export const untamedSkillHandlers = Object.freeze({
  "ranger.unleash-ranger": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      const state = untamedState.from(context);
      state.rangerUnleashed = true;
      state.ambushReadyUntil = context.start + 4;
    },
  },
  "ranger.unleash-pet": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      const state = untamedState.from(context);
      state.rangerUnleashed = false;
      state.ambushReadyUntil = context.start + 4;
    },
  },
});
