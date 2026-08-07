import {
  afterSkillEffects,
  defineNativeModule,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import {
  holosmithEventHandlers,
  holosmithSchedulerHooks,
  holosmithSkillHandlers,
} from "./handlers.js";
import { holosmithAttributeRules, holosmithCastRules } from "./rules.js";
import { HOLOSMITH_SKILL_MECHANICS } from "./skills.js";
import { createHolosmithState } from "./state.js";
import { bindHolosmithUi } from "./ui.js";

const {
  afterCast: holosmithAfterCast,
  ...holosmithAdvancedSchedulerHooks
} = holosmithSchedulerHooks;

export const holosmithModule = defineNativeModule({
  id: "Holosmith",
  data: createEngineerModuleData("Holosmith", {
    skillMechanics: HOLOSMITH_SKILL_MECHANICS,
    handlers: holosmithSkillHandlers,
  }),
  state: { scheduler: createHolosmithState, resolver: createHolosmithState },
  mechanics: {
    modifiers: holosmithAttributeRules,
    castRules: holosmithCastRules,
    castLifecycle: [afterSkillEffects(holosmithAfterCast)],
    schedulerHooks: holosmithAdvancedSchedulerHooks,
    resolverHooks: { eventHandlers: holosmithEventHandlers },
  },
  presentation: bindHolosmithUi,
});
