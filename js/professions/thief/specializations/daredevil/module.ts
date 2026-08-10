import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../../catalog-data.js";
import {
  daredevilAttributeRules,
  daredevilCastRules,
  daredevilSchedulerHooks,
} from "./rules.js";
import { daredevilState } from "./state.js";
import { DAREDEVIL_SKILL_MECHANICS } from "./skills.js";

export const daredevilModule = defineNativeModule({
  id: "Daredevil",
  data: createThiefModuleData("Daredevil", {
    skillMechanics: DAREDEVIL_SKILL_MECHANICS,
  }),
  state: { scheduler: daredevilState.create, resolver: daredevilState.create },
  mechanics: {
    modifiers: daredevilAttributeRules,
    castRules: daredevilCastRules,
    schedulerHooks: daredevilSchedulerHooks,
  },
});
