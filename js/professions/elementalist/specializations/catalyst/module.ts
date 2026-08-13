import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import { catalystCastRules, catalystSchedulerHooks } from "./rules.js";
import { createCatalystState } from "./state.js";
import { catalystUi } from "./ui.js";

export const catalystModule = defineNativeModule({
  id: "Catalyst",
  data: createElementalistModuleData("Catalyst"),
  state: { scheduler: createCatalystState, resolver: createCatalystState },
  mechanics: {
    castRules: catalystCastRules,
    schedulerHooks: catalystSchedulerHooks,
  },
  presentation: catalystUi,
});
