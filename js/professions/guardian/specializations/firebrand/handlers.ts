import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import { guardianTomeSkillHandlers } from "./tomes.js";

export const firebrandSkillHandlers = Object.freeze({
  // replaceSkill owns the entire cast (no platform effects run); stowing a
  // tome is pure state bookkeeping with no GW2 skill effects of its own.
  "guardian.stow-tome": replaceSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.stow-tome"],
  }),
  // augmentSkill lets the platform apply the skill's normal hit/condition
  // packets; the beforeEffects hook only handles the page-resource accounting.
  "guardian.tome-page": augmentSkill({
    beforeEffects: guardianTomeSkillHandlers["guardian.tome-page"],
  }),
});
