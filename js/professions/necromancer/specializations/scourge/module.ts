import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import {
  scourgeEventReactions,
} from "./handlers.js";
import {
  scourgeAttributeRules,
  scourgeCastRules,
} from "./rules.js";
import { createScourgeState } from "./state.js";
import { scourgeUi } from "./ui.js";
import { SCOURGE_BASE_SKILL_MECHANICS, SCOURGE_QUICKNESS_CAST_TIMES_MS } from "./skills.js";
import { scourgeSkillHandlers } from "./handlers.js";

export const scourgeModule = defineNativeModule({
  id: "Scourge",
  data: createNecromancerModuleData("Scourge", {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    quicknessCastTimes: SCOURGE_QUICKNESS_CAST_TIMES_MS,
    handlers: scourgeSkillHandlers,
  }),
  state: { scheduler: createScourgeState, resolver: createScourgeState },
  mechanics: {
    modifiers: scourgeAttributeRules,
    castRules: scourgeCastRules,
    resolverHooks: { eventReactions: scourgeEventReactions },
  },
  presentation: scourgeUi,
});
