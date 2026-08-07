import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  vindicatorEventHandlers,
  vindicatorEventReactions,
} from "./handlers.js";
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks,
} from "./rules.js";
import { createVindicatorState } from "./state.js";
import { vindicatorUi } from "./ui.js";
import { VINDICATOR_BASE_SKILL_MECHANICS } from "./skills.js";
import { vindicatorSkillHandlers } from "./handlers.js";

export const vindicatorModule = defineNativeModule({
  id: "Vindicator",
  data: createRevenantModuleData("Vindicator", {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    handlers: vindicatorSkillHandlers,
  }),
  state: { scheduler: createVindicatorState, resolver: createVindicatorState },
  mechanics: {
    modifiers: vindicatorAttributeRules,
    castRules: vindicatorCastRules,
    schedulerHooks: vindicatorSchedulerHooks,
    resolverHooks: {
      eventHandlers: vindicatorEventHandlers,
      eventReactions: vindicatorEventReactions,
    },
  },
  presentation: vindicatorUi,
});
