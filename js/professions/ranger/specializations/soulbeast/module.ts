import {
  defineNativeModule,
  onBuffApplied,
  onConditionApplied,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { soulbeastSkillHandlers } from "./handlers.js";
import { soulbeastAttributeRules, soulbeastCastRules } from "./rules.js";
import { SOULBEAST_BASE_SKILL_MECHANICS } from "./skills.js";
import { soulbeastState } from "./state.js";
import { bindSoulbeastUi } from "./ui.js";
import {
  reactToRangerWinterBite,
  reactToSoulbeastBuff,
  reactToSoulbeastCondition,
  reactToSoulbeastControl,
  reactToSoulbeastDamage,
  soulbeastEventHandlers,
} from "./resolver.js";
import { SOULBEAST_BALANCE_PROFILES } from "./profiles.js";

export const soulbeastModule = defineNativeModule({
  id: "Soulbeast",
  data: createRangerModuleData("Soulbeast", {
    skillMechanics: SOULBEAST_BASE_SKILL_MECHANICS,
    balanceProfiles: SOULBEAST_BALANCE_PROFILES,
    handlers: soulbeastSkillHandlers,
  }),
  // Scheduler and resolver each get their own independent state instance — they run in separate phases.
  state: { scheduler: soulbeastState.create, resolver: soulbeastState.create },
  mechanics: {
    modifiers: soulbeastAttributeRules,
    castRules: soulbeastCastRules,
    resolverHooks: { eventHandlers: soulbeastEventHandlers },
    reactions: [
      onResolvedDamage({
        id: "ranger.soulbeast-damage",
        order: 20,
        handler: reactToSoulbeastDamage,
      }),
      // Winter's Bite runs at order 30 so it fires after the main damage reaction (order 20) has already processed the hit.
      onResolvedDamage({
        id: "ranger.winters-bite",
        order: 30,
        handler: reactToRangerWinterBite,
      }),
      onResolvedControl({
        id: "ranger.soulbeast-control",
        order: 20,
        handler: reactToSoulbeastControl,
      }),
      onConditionApplied({
        id: "ranger.soulbeast-condition",
        order: 20,
        handler: reactToSoulbeastCondition,
      }),
      onBuffApplied({
        id: "ranger.soulbeast-buff",
        order: 20,
        handler: reactToSoulbeastBuff,
      }),
    ],
  },
  presentation: bindSoulbeastUi,
});
