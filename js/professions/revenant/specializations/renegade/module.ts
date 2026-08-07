import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../../catalog-data.js";
import {
  renegadeEventHandlers,
  renegadeEventReactions,
} from "./handlers.js";
import {
  renegadeAttributeRules,
  renegadeCastRules,
  renegadeSchedulerHooks,
} from "./rules.js";
import { createRenegadeState } from "./state.js";
import { renegadeUi } from "./ui.js";
import { RENEGADE_BASE_SKILL_MECHANICS } from "./skills.js";
import { renegadeSkillHandlers } from "./handlers.js";

export const renegadeModule = defineNativeModule({
  id: "Renegade",
  data: createRevenantModuleData("Renegade", {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    handlers: renegadeSkillHandlers,
  }),
  state: { scheduler: createRenegadeState, resolver: createRenegadeState },
  mechanics: {
    modifiers: renegadeAttributeRules,
    castRules: renegadeCastRules,
    schedulerHooks: renegadeSchedulerHooks,
    resolverHooks: {
      eventHandlers: renegadeEventHandlers,
      eventReactions: renegadeEventReactions,
    },
  },
  presentation: renegadeUi,
});
