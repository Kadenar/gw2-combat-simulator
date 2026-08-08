import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { galeshotSchedulerHooks, galeshotSkillHandlers } from "./handlers.js";
import { galeshotAttributeRules, galeshotCastRules } from "./rules.js";
import { GALESHOT_BASE_SKILL_MECHANICS } from "./skills.js";
import { galeshotState } from "./state.js";
import { galeshotUi } from "./ui.js";

export const galeshotModule = defineNativeModule({
  id: "Galeshot",
  data: createRangerModuleData("Galeshot", {
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS,
    handlers: galeshotSkillHandlers,
  }),
  state: { scheduler: galeshotState.create, resolver: galeshotState.create },
  mechanics: {
    modifiers: galeshotAttributeRules,
    castRules: galeshotCastRules,
    schedulerHooks: galeshotSchedulerHooks,
  },
  presentation: galeshotUi,
});
