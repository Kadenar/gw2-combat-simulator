import { augmentSkill } from "../../../../platform/gw2/native-profession.js";
import type { ElementalistCastContext } from "../../types.js";
import { applyAltruisticAspect } from "./rules.js";

export const evokerSkillHandlers = Object.freeze({
  "elementalist.evoker-meditation": augmentSkill<ElementalistCastContext>({
    afterEffects: applyAltruisticAspect,
  }),
});
