import { necromancerShadeSkillHandlers } from "./shades.js";
import {
  augmentSkillHandler,
  replaceSkillHandler,
} from "../../../../platform/engine/skill-handlers.js";

export const scourgeSkillHandlers = new Map([
  [
    "necromancer.shade",
    replaceSkillHandler(necromancerShadeSkillHandlers["necromancer.shade"]),
  ],
  [
    "necromancer.barrier",
    augmentSkillHandler(null, {
      afterEffects: necromancerShadeSkillHandlers["necromancer.barrier"],
    }),
  ],
]);
