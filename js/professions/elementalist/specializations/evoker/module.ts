import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import { evokerCastRules, evokerSchedulerHooks } from "./rules.js";
import { createEvokerState } from "./state.js";
import { evokerUi } from "./ui.js";
import { EVOKER_SKILL_MECHANICS } from "./skills.js";

export const evokerModule = defineNativeModule({
  id: "Evoker",
  data: createElementalistModuleData("Evoker", {
    skillMechanics: EVOKER_SKILL_MECHANICS,
  }),
  state: { scheduler: createEvokerState, resolver: createEvokerState },
  mechanics: {
    castRules: evokerCastRules,
    schedulerHooks: evokerSchedulerHooks,
  },
  presentation: evokerUi,
});
