import {
  defineNativeModule,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import {
  dragonhunterEventHandlers,
  dragonhunterEventReactions,
  dragonhunterSkillHandlers,
} from "./handlers.js";
import {
  dragonhunterAttributeRules,
  dragonhunterSchedulerHooks,
} from "./rules.js";
import { DRAGONHUNTER_SKILL_MECHANICS } from "./skills.js";
import { dragonhunterState } from "./state.js";
import { dragonhunterUi } from "./ui.js";

export const dragonhunterModule = defineNativeModule({
  id: "Dragonhunter",
  data: createGuardianModuleData("Dragonhunter", {
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS,
    handlers: dragonhunterSkillHandlers,
  }),
  state: {
    scheduler: dragonhunterState.create,
    resolver: dragonhunterState.create,
  },
  mechanics: {
    modifiers: dragonhunterAttributeRules,
    schedulerHooks: dragonhunterSchedulerHooks,
    reactions: [
      ...dragonhunterEventReactions.damage.map(onResolvedDamage),
      ...dragonhunterEventReactions.control.map(onResolvedControl),
    ],
    resolverHooks: { eventHandlers: dragonhunterEventHandlers },
  },
  presentation: dragonhunterUi,
});
