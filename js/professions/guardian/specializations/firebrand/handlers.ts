import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import { guardianTomeSkillHandlers } from "./tomes.js";

export const firebrandSkillHandlers = Object.freeze({
  "guardian.stow-tome": replaceSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.stow-tome"],
  }),
  "guardian.tome-page": augmentSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.tome-page"],
  }),
});
