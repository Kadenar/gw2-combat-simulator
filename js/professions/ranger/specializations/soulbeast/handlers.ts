import { soulbeastState } from "./state.js";
import type { RangerCastContext } from "../../types.js";

export const soulbeastSkillHandlers = Object.freeze({
  "ranger.beastmode-enter": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      soulbeastState.from(context).beastmodeActive = true;
    },
  },
  "ranger.beastmode-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      soulbeastState.from(context).beastmodeActive = false;
    },
  },
  "ranger.one-wolf-pack": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext) {
      soulbeastState.from(context).oneWolfPackUntil = context.start + 6;
    },
  },
});
