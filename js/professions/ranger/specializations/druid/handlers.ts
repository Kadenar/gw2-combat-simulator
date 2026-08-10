import { enterAvatar, leaveAvatar } from "./mechanics.js";

export const druidSkillHandlers = Object.freeze({
  "ranger.celestial-avatar-enter": {
    mode: "augment" as const,
    afterEffects: enterAvatar,
  },
  "ranger.celestial-avatar-exit": {
    mode: "augment" as const,
    afterEffects: leaveAvatar,
  },
});
