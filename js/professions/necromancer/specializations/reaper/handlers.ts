import { executionersScythe, soulSpiral } from "./shroud.js";
import { augmentSkillHandler } from "../../../../platform/engine/skill-handlers.js";

export const reaperSkillHandlers = new Map([
  [
    "necromancer.executioners-scythe",
    augmentSkillHandler(null, {
      afterEffect: executionersScythe,
    }),
  ],
  [
    "necromancer.soul-spiral",
    augmentSkillHandler(null, {
      afterEffect: soulSpiral,
    }),
  ],
]);
