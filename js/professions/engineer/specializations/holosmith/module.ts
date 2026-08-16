import {
  afterSkillEffects,
  defineNativeModule,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import { holosmithSkillHandlers } from "./handlers.js";
import { holosmithResolverEventHandlers } from "./resolver.js";
import {
  holosmithAdvancedSchedulerHooks,
  holosmithAfterCast,
  holosmithAttributeRules,
  holosmithCastRules,
} from "./rules.js";
import { HOLOSMITH_SKILL_MECHANICS } from "./skills.js";
import { holosmithState } from "./state.js";
import { bindHolosmithUi } from "./ui.js";

export const holosmithModule = defineNativeModule({
  id: "Holosmith",
  data: createEngineerModuleData("Holosmith", {
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    handlers: holosmithSkillHandlers,
  }),
  // Scheduler and resolver share the same state factory so heat values are consistent
  // when the resolver reads them during damage attribution.
  state: { scheduler: holosmithState.create, resolver: holosmithState.create },
  mechanics: {
    modifiers: holosmithAttributeRules,
    castRules: holosmithCastRules,
    castLifecycle: [afterSkillEffects(holosmithAfterCast)],
    schedulerHooks: holosmithAdvancedSchedulerHooks,
    resolverHooks: { eventHandlers: holosmithResolverEventHandlers },
  },
  presentation: bindHolosmithUi,
});
