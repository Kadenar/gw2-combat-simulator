import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../../catalog-data.js";
import { daredevilSchedulerHooks } from "./handlers.js";
import { daredevilAttributeRules } from "./rules.js";
import { createDaredevilState } from "./state.js";
import { DAREDEVIL_SKILL_MECHANICS } from "./skills.js";

export const daredevilModule = defineNativeModule({
  id: "Daredevil",
  data: createThiefModuleData("Daredevil", {
    skillMechanics: DAREDEVIL_SKILL_MECHANICS,
  }),
  state: { scheduler: createDaredevilState, resolver: createDaredevilState },
  mechanics: {
    modifiers: daredevilAttributeRules,
    schedulerHooks: daredevilSchedulerHooks,
  },
});
