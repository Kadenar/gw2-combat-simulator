import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  heraldEventHandlers,
  heraldEventReactions,
} from "./handlers.js";
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks,
} from "./rules.js";
import { createHeraldState } from "./state.js";
import { heraldUi } from "./ui.js";
import { HERALD_BASE_SKILL_MECHANICS } from "./skills.js";
import { heraldSkillHandlers } from "./handlers.js";

export const heraldModule = defineNativeModule({
  id: "Herald",
  data: createRevenantModuleData("Herald", {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    handlers: heraldSkillHandlers,
  }),
  state: { scheduler: createHeraldState, resolver: createHeraldState },
  mechanics: {
    modifiers: heraldAttributeRules,
    castRules: heraldCastRules,
    schedulerHooks: heraldSchedulerHooks,
    resolverHooks: {
      eventHandlers: heraldEventHandlers,
      eventReactions: heraldEventReactions,
    },
  },
  presentation: heraldUi,
});
