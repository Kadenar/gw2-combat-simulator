import { augmentSkill } from "../../../../platform/gw2/native-profession.js";
import type { ElementalistCastContext } from "../../types.js";
import { applyTempestShoutTraits } from "./rules.js";

export const tempestSkillHandlers = Object.freeze({
  "elementalist.tempest-shout": augmentSkill<ElementalistCastContext>({
    afterEffects: applyTempestShoutTraits,
  }),
});
