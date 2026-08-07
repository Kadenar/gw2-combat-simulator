import {
  defineNativeModule,
  onConditionApplied,
} from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import {
  scourgeEventReactions,
  scourgeSkillHandlers,
} from "./handlers.js";
import {
  scourgeAttributeRules,
  scourgeCastRules,
} from "./rules.js";
import { scourgeState } from "./state.js";
import { scourgeUi } from "./ui.js";
import { SCOURGE_BASE_SKILL_MECHANICS, SCOURGE_QUICKNESS_CAST_TIMES_MS } from "./skills.js";

export const scourgeModule = defineNativeModule({
  id: "Scourge",
  data: createNecromancerModuleData("Scourge", {
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS,
    quicknessCastTimes: SCOURGE_QUICKNESS_CAST_TIMES_MS,
    handlers: scourgeSkillHandlers,
  }),
  state: { scheduler: scourgeState.create, resolver: scourgeState.create },
  mechanics: {
    modifiers: scourgeAttributeRules,
    castRules: scourgeCastRules,
    reactions: [onConditionApplied({
      id: "necromancer.scourge.condition",
      handler: scourgeEventReactions.condition,
    })],
  },
  presentation: scourgeUi,
});
