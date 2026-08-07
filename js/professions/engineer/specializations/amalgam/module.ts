import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import {
  amalgamEventReactions,
  amalgamSchedulerHooks,
  amalgamSkillHandlers,
} from "./handlers.js";
import { amalgamAttributeRules, amalgamCastRules } from "./rules.js";
import { AMALGAM_SKILL_MECHANICS } from "./skills.js";
import { amalgamState } from "./state.js";
import { bindAmalgamUi } from "./ui.js";

export const amalgamModule = defineNativeModule({
  id: "Amalgam",
  data: createEngineerModuleData("Amalgam", {
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    handlers: amalgamSkillHandlers,
  }),
  state: { scheduler: amalgamState.create, resolver: amalgamState.create },
  mechanics: {
    modifiers: amalgamAttributeRules,
    castRules: amalgamCastRules,
    schedulerHooks: amalgamSchedulerHooks,
    reactions: [onResolvedDamage({
      id: "engineer.amalgam.damage",
      handler: amalgamEventReactions.damage,
    })],
  },
  presentation: bindAmalgamUi,
});
