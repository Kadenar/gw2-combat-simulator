import {
  defineNativeModule,
  onResolvedControl,
  onResolvedDamage,
} from "../../../../platform/gw2/native-profession.js";
import { createGuardianModuleData } from "../../catalog-data.js";
import { dragonhunterSkillHandlers } from "./handlers.js";
import {
  dragonhunterEventHandlers,
  dragonhunterEventReactions,
} from "./resolver.js";
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
    // Same factory for both phases: scheduler writes tetherUntil during cast,
    // resolver re-derives it from emitted events, so they must start identical.
    scheduler: dragonhunterState.create,
    resolver: dragonhunterState.create,
  },
  mechanics: {
    modifiers: dragonhunterAttributeRules,
    schedulerHooks: dragonhunterSchedulerHooks,
    reactions: [
      // onResolvedDamage/onResolvedControl wrap the handlers so they fire on
      // "damage.resolved" / control events in resolver order, not as raw event handlers
      ...dragonhunterEventReactions.damage.map(onResolvedDamage),
      ...dragonhunterEventReactions.control.map(onResolvedControl),
    ],
    resolverHooks: { eventHandlers: dragonhunterEventHandlers },
  },
  presentation: dragonhunterUi,
});
