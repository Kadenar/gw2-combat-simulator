import { enterAvatar, leaveAvatar } from "./mechanics.js";
import type { RangerCastContext, RangerSkill } from "../../types.js";
import { applyCelestialAvatarTraits } from "./rules.js";

export const druidSkillHandlers = Object.freeze({
  "ranger.celestial-avatar-enter": {
    mode: "augment" as const,
    afterEffects: enterAvatar,
  },
  "ranger.celestial-avatar-exit": {
    mode: "augment" as const,
    afterEffects(context: RangerCastContext, skill: RangerSkill) {
      // Manual exit: pass exhausted=false so half astral force is retained, and pass the skill for the sigil swap
      leaveAvatar(context, false, context.effectiveEnd, skill);
    },
  },
  "ranger.celestial-avatar-skill": {
    mode: "augment" as const,
    afterEffects: applyCelestialAvatarTraits,
  },
});
