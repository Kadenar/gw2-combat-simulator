import {
  defineNativeModule,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import { reaperResolverEventReactions } from "./resolver.js";
import {
  reaperAttributeRules,
  reaperCastRules,
  reaperSchedulerHooks,
} from "./rules.js";
import { reaperState } from "./state.js";
import { reaperUi } from "./ui.js";
import { REAPER_BASE_SKILL_MECHANICS } from "./skills.js";
import { reaperSkillHandlers } from "./handlers.js";
import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";
import { REAPER_BALANCE_PROFILES } from "./profiles.js";

export const reaperModule = defineNativeModule({
  id: "Reaper",
  data: createNecromancerModuleData("Reaper", {
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    balanceProfiles: REAPER_BALANCE_PROFILES,
    handlers: reaperSkillHandlers,
    // Shroud autoattack chain runs separately from the out-of-shroud chain; both must be registered.
    autoattackChains: {
      additional: [[ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]],
    },
  }),
  // Reaper adds no persistent specialization state; both phases share the same empty factory.
  state: { scheduler: reaperState.create, resolver: reaperState.create },
  mechanics: {
    modifiers: reaperAttributeRules,
    castRules: reaperCastRules,
    reactions: [
      onResolvedDamage({
        id: "necromancer.reaper.damage",
        handler: reaperResolverEventReactions.damage,
      }),
      onResolvedControl({
        id: "necromancer.reaper.control",
        handler: reaperResolverEventReactions.control,
      }),
      onConditionApplied({
        id: "necromancer.reaper.condition",
        handler: reaperResolverEventReactions.condition,
      }),
    ],
    schedulerHooks: reaperSchedulerHooks,
  },
  presentation: reaperUi,
});
