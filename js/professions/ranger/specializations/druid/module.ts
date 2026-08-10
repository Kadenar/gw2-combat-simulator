import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { druidSkillHandlers } from "./handlers.js";
import { druidCastRules, druidSchedulerHooks } from "./rules.js";
import { DRUID_BASE_SKILL_MECHANICS } from "./skills.js";
import { druidState } from "./state.js";
import { druidUi } from "./ui.js";

export const druidModule = defineNativeModule({
  id: "Druid",
  data: createRangerModuleData("Druid", {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    handlers: druidSkillHandlers,
  }),
  state: { scheduler: druidState.create, resolver: druidState.create },
  mechanics: {
    castRules: druidCastRules,
    schedulerHooks: druidSchedulerHooks,
  },
  presentation: druidUi,
});
