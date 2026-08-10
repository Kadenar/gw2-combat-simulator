import {
  augmentSkill,
  replaceSkill,
} from "../../../../platform/gw2/native-profession.js";
import { guardianRadiantForgeSkillHandlers } from "./radiant-forge.js";

export const luminarySkillHandlers = Object.freeze({
  "guardian.radiant-forge": replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.radiant-forge"],
  }),
  "guardian.radiant-weapon": augmentSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.radiant-weapon"],
  }),
  "guardian.glaring-burst": replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers["guardian.glaring-burst"],
  }),
});
