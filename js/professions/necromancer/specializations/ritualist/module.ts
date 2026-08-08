import { defineNativeModule, onResolvedDamage } from "../../../../platform/gw2/native-profession.js";
import { createNecromancerModuleData } from "../../catalog-data.js";
import {
  ritualistEventHandlers,
  ritualistEventReactions,
  ritualistSchedulerHooks,
} from "./handlers.js";
import { ritualistAttributeRules } from "./rules.js";
import { ritualistState } from "./state.js";
import { ritualistUi } from "./ui.js";
import { RITUALIST_BASE_SKILL_MECHANICS } from "./skills.js";
import { ritualistSkillHandlers } from "./handlers.js";

export const ritualistModule = defineNativeModule({
  id: "Ritualist",
  data: createNecromancerModuleData("Ritualist", {
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS,
    handlers: ritualistSkillHandlers,
  }),
  state: { scheduler: ritualistState.create, resolver: ritualistState.create },
  mechanics: {
    modifiers: ritualistAttributeRules,
    resolverHooks: { eventHandlers: ritualistEventHandlers },
    reactions: [onResolvedDamage({ id: "necromancer.ritualist.damage", handler: ritualistEventReactions.damage })],
    schedulerHooks: ritualistSchedulerHooks,
  },
  presentation: ritualistUi,
});
