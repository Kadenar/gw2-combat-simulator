import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import { tempestCastRules, tempestSchedulerHooks } from "./rules.js";
import { createTempestState } from "./state.js";
import { tempestUi } from "./ui.js";

export const tempestModule = defineNativeModule({
  id: "Tempest",
  data: createElementalistModuleData("Tempest"),
  state: { scheduler: createTempestState, resolver: createTempestState },
  mechanics: {
    castRules: tempestCastRules,
    schedulerHooks: tempestSchedulerHooks,
  },
  presentation: tempestUi,
});
