import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../../catalog-data.js";
import {
  specterSchedulerHooks,
  specterSkillHandlers,
} from "./handlers.js";
import {
  specterAttributeRules,
  specterCastRules,
} from "./rules.js";
import { specterState } from "./state.js";
import { specterUi } from "./ui.js";
import { SPECTER_SKILL_MECHANICS } from "./skills.js";

export const specterModule = defineNativeModule({
  id: "Specter",
  data: createThiefModuleData("Specter", {
    skillMechanics: SPECTER_SKILL_MECHANICS,
    handlers: specterSkillHandlers,
  }),
  state: { scheduler: specterState.create, resolver: specterState.create },
  mechanics: {
    modifiers: specterAttributeRules,
    castRules: specterCastRules,
    schedulerHooks: specterSchedulerHooks,
  },
  presentation: specterUi,
});
