import {
  defineNativeModule,
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
import { createReaperState } from "./state.js";
import { reaperUi } from "./ui.js";
import {
  REAPER_BASE_SKILL_MECHANICS,
  REAPER_QUICKNESS_CAST_TIMES_MS,
} from "./skills.js";
import { reaperSkillHandlers } from "./handlers.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";

export const reaperModule = defineNativeModule({
  id: "Reaper",
  data: createNecromancerModuleData("Reaper", {
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    quicknessCastTimes: REAPER_QUICKNESS_CAST_TIMES_MS,
    handlers: reaperSkillHandlers,
    autoattackChains: {
      additional: [[ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]],
    },
  }),
  state: { scheduler: createReaperState, resolver: createReaperState },
  mechanics: {
    modifiers: reaperAttributeRules,
    castRules: reaperCastRules,
    reactions: [
      onResolvedDamage({ id: "necromancer.reaper.damage", handler: reaperEventReactions.damage }),
      onResolvedControl({ id: "necromancer.reaper.control", handler: reaperEventReactions.control }),
      { phase: "resolver" as const, eventType: "condition", id: "necromancer.reaper.condition", order: 0, handler: reaperEventReactions.condition },
    ],
    schedulerHooks: reaperSchedulerHooks,
  },
  presentation: reaperUi,
});
