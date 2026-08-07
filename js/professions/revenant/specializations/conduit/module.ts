import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  conduitEventHandlers,
  conduitSkillHandlers,
} from "./handlers.js";
import {
  conduitAttributeRules,
  conduitCastRules,
  conduitSchedulerHooks,
} from "./rules.js";
import { conduitState } from "./state.js";
import { conduitUi } from "./ui.js";
import { CONDUIT_BASE_SKILL_MECHANICS } from "./skills.js";

export const conduitModule = defineNativeModule({
  id: "Conduit",
  data: createRevenantModuleData("Conduit", {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    handlers: conduitSkillHandlers,
  }),
  state: { scheduler: conduitState.create, resolver: conduitState.create },
  mechanics: {
    modifiers: conduitAttributeRules,
    castRules: conduitCastRules,
    schedulerHooks: conduitSchedulerHooks,
    resolverHooks: {
      eventHandlers: conduitEventHandlers,
    },
  },
  presentation: conduitUi,
});
