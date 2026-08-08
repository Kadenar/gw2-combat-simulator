import { defineNativeModule, onResolvedDamage } from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import {
  harbingerEventReactions,
  harbingerSchedulerHooks,
} from "./handlers.js";
import {
  harbingerAttributeRules,
  harbingerCastRules,
} from "./rules.js";
import { harbingerState } from "./state.js";
import { harbingerUi } from "./ui.js";
import { HARBINGER_BASE_SKILL_MECHANICS } from "./skills.js";
import { harbingerSkillHandlers } from "./handlers.js";

export const harbingerModule = defineNativeModule({
  id: "Harbinger",
  data: createNecromancerModuleData("Harbinger", {
    skillMechanics: HARBINGER_BASE_SKILL_MECHANICS,
    handlers: harbingerSkillHandlers,
  }),
  state: { scheduler: harbingerState.create, resolver: harbingerState.create },
  mechanics: {
    modifiers: harbingerAttributeRules,
    castRules: harbingerCastRules,
    reactions: [onResolvedDamage({ id: "necromancer.harbinger.damage", handler: harbingerEventReactions.damage })],
    schedulerHooks: harbingerSchedulerHooks,
  },
  presentation: harbingerUi,
});
