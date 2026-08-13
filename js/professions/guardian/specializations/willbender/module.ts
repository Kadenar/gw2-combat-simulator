import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import { willbenderSkillHandlers } from "./handlers.js";
import { willbenderEventHandlers } from "./resolver.js";
import { willbenderAttributeRules, willbenderSchedulerHooks } from "./rules.js";
import { WILLBENDER_SKILL_MECHANICS } from "./skills.js";
import { willbenderState } from "./state.js";
import { willbenderUi } from "./ui.js";

export const willbenderModule = defineNativeModule({
  id: "Willbender",
  data: createGuardianModuleData("Willbender", {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
    handlers: willbenderSkillHandlers,
  }),
  state: {
    scheduler: willbenderState.create,
    resolver: willbenderState.create,
  },
  mechanics: {
    modifiers: willbenderAttributeRules,
    schedulerHooks: willbenderSchedulerHooks,
    resolverHooks: { eventHandlers: willbenderEventHandlers },
  },
  presentation: willbenderUi,
});
