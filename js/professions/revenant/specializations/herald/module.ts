import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import { heraldSkillHandlers } from "./handlers.js";
import { heraldEventHandlers } from "./resolver.js";
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks,
} from "./rules.js";
import { heraldState } from "./state.js";
import { heraldUi } from "./ui.js";
import { HERALD_BASE_SKILL_MECHANICS } from "./skills.js";

export const heraldModule = defineNativeModule({
  id: "Herald",
  data: createRevenantModuleData("Herald", {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    handlers: heraldSkillHandlers,
  }),
  state: { scheduler: heraldState.create, resolver: heraldState.create },
  mechanics: {
    modifiers: heraldAttributeRules,
    castRules: heraldCastRules,
    schedulerHooks: heraldSchedulerHooks,
    resolverHooks: {
      eventHandlers: heraldEventHandlers,
    },
  },
  presentation: heraldUi,
});
