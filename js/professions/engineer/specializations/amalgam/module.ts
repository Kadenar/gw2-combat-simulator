import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../../catalog-data.js";
import { amalgamSkillHandlers } from "./handlers.js";
import { amalgamResolverEventReactions } from "./resolver.js";
import {
  amalgamAttributeRules,
  amalgamCastRules,
  amalgamSchedulerHooks,
} from "./rules.js";
import { AMALGAM_SKILL_MECHANICS } from "./skills.js";
import { amalgamState } from "./state.js";
import { AMALGAM_BALANCE_PROFILES } from "./profiles.js";
import { bindAmalgamUi } from "./ui.js";

export const amalgamModule = defineNativeModule({
  id: "Amalgam",
  data: createEngineerModuleData("Amalgam", {
    skillMechanics: AMALGAM_SKILL_MECHANICS,
    balanceProfiles: AMALGAM_BALANCE_PROFILES,
    handlers: amalgamSkillHandlers,
  }),
  state: { scheduler: amalgamState.create, resolver: amalgamState.create },
  mechanics: {
    modifiers: amalgamAttributeRules,
    castRules: amalgamCastRules,
    schedulerHooks: amalgamSchedulerHooks,
    reactions: [
      onResolvedDamage({
        id: "engineer.amalgam.damage",
        handler: amalgamResolverEventReactions.damage,
      }),
    ],
  },
  presentation: bindAmalgamUi,
});
