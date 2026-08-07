import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../../catalog-data.js";
import {
  antiquarySchedulerHooks,
} from "./handlers.js";
import { antiquaryResolverEventReactions } from "./resolver.js";
import {
  antiquaryAttributeRules,
  antiquaryCastRules,
} from "./rules.js";
import { createAntiquaryState } from "./state.js";
import { antiquaryUi } from "./ui.js";
import { ANTIQUARY_SKILL_MECHANICS } from "./skills.js";
import { antiquarySkillHandlers } from "./handlers.js";

export const antiquaryModule = defineNativeModule({
  id: "Antiquary",
  data: createThiefModuleData("Antiquary", {
    skillMechanics: ANTIQUARY_SKILL_MECHANICS,
    handlers: antiquarySkillHandlers,
  }),
  state: { scheduler: createAntiquaryState, resolver: createAntiquaryState },
  mechanics: {
    modifiers: antiquaryAttributeRules,
    castRules: antiquaryCastRules,
    schedulerHooks: antiquarySchedulerHooks,
    resolverHooks: { eventReactions: antiquaryResolverEventReactions },
  },
  presentation: antiquaryUi,
});
