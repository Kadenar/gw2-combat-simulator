import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import { weaverCastRules, weaverSchedulerHooks } from "./rules.js";
import { createWeaverState } from "./state.js";

export const weaverModule = defineNativeModule({
  id: "Weaver",
  data: createElementalistModuleData("Weaver"),
  state: { scheduler: createWeaverState, resolver: createWeaverState },
  mechanics: {
    castRules: weaverCastRules,
    schedulerHooks: weaverSchedulerHooks,
  },
});
