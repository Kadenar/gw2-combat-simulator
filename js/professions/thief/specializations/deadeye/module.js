import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../../catalog-data.js";
import {
  deadeyeSchedulerHooks,
} from "./handlers.js";
import {
  deadeyeAttributeRules,
  deadeyeCastRules,
} from "./rules.js";
import { deadeyeState } from "./state.js";
import { deadeyeUi } from "./ui.js";
import { DEADEYE_SKILL_MECHANICS } from "./skills.js";
import { deadeyeSkillHandlers } from "./handlers.js";

export const deadeyeModule = defineNativeModule({
  id: "Deadeye",
  data: createThiefModuleData("Deadeye", {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    handlers: deadeyeSkillHandlers,
  }),
  state: { scheduler: deadeyeState.create, resolver: deadeyeState.create },
  mechanics: {
    modifiers: deadeyeAttributeRules,
    castRules: deadeyeCastRules,
    schedulerHooks: deadeyeSchedulerHooks,
  },
  presentation: deadeyeUi,
});
