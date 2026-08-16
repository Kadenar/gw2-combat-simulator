import {
  defineNativeModule,
  onAuraApplied,
} from "../../../../platform/gw2/native-profession.js";
import { createElementalistModuleData } from "../../catalog-data.js";
import {
  tempestAttributeRules,
  tempestCastRules,
  tempestSchedulerHooks,
} from "./rules.js";
import { createTempestState } from "./state.js";
import { tempestUi } from "./ui.js";
import { TEMPEST_SKILL_MECHANICS } from "./skills.js";
import { applyTempestResolverAura } from "./resolver.js";
import { tempestSkillHandlers } from "./handlers.js";

export const tempestModule = defineNativeModule({
  id: "Tempest",
  data: createElementalistModuleData("Tempest", {
    skillMechanics: TEMPEST_SKILL_MECHANICS,
    handlers: tempestSkillHandlers,
  }),
  state: { scheduler: createTempestState, resolver: createTempestState },
  mechanics: {
    modifiers: tempestAttributeRules,
    castRules: tempestCastRules,
    schedulerHooks: tempestSchedulerHooks,
    reactions: [
      onAuraApplied({
        id: "elementalist.tempest-aura",
        handler: applyTempestResolverAura,
      }),
    ],
  },
  presentation: tempestUi,
});
