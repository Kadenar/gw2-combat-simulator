import {
  defineNativeModule,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import {
  reaperEventReactions,
  reaperSchedulerHooks,
} from "./handlers.js";
import {
  reaperAttributeRules,
  reaperCastRules,
} from "./rules.js";
import { reaperState } from "./state.js";
import { reaperUi } from "./ui.js";
import { REAPER_BASE_SKILL_MECHANICS } from "./skills.js";
import { reaperSkillHandlers } from "./handlers.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";

export const reaperModule = defineNativeModule({
  id: "Reaper",
  data: createNecromancerModuleData("Reaper", {
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    handlers: reaperSkillHandlers,
    autoattackChains: {
      additional: [[ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]],
    },
  }),
  state: { scheduler: reaperState.create, resolver: reaperState.create },
  mechanics: {
    modifiers: reaperAttributeRules,
    castRules: reaperCastRules,
    reactions: [
      onResolvedDamage({ id: "necromancer.reaper.damage", handler: reaperEventReactions.damage }),
      onResolvedControl({ id: "necromancer.reaper.control", handler: reaperEventReactions.control }),
      onConditionApplied({ id: "necromancer.reaper.condition", handler: reaperEventReactions.condition }),
    ],
    schedulerHooks: reaperSchedulerHooks,
  },
  presentation: reaperUi,
});
