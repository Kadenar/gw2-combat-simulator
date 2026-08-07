import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  vindicatorEventHandlers,
  vindicatorSkillHandlers,
} from "./handlers.js";
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks,
} from "./rules.js";
import { vindicatorState } from "./state.js";
import { vindicatorUi } from "./ui.js";
import { VINDICATOR_BASE_SKILL_MECHANICS } from "./skills.js";

export const vindicatorModule = defineNativeModule({
  id: "Vindicator",
  data: createRevenantModuleData("Vindicator", {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    handlers: vindicatorSkillHandlers,
  }),
  state: { scheduler: vindicatorState.create, resolver: vindicatorState.create },
  mechanics: {
    modifiers: vindicatorAttributeRules,
    castRules: vindicatorCastRules,
    schedulerHooks: vindicatorSchedulerHooks,
    resolverHooks: {
      eventHandlers: vindicatorEventHandlers,
    },
  },
  presentation: vindicatorUi,
});
