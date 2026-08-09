import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../../catalog-data.js";
import { PARAGON_SKILL_MECHANICS } from "./skills.js";
import { paragonSkillHandlers, paragonSchedulerHooks } from "./handlers.js";
import { paragonAttributeRules } from "./rules.js";
import { paragonState } from "./state.js";
import { paragonUi } from "./ui.js";
import { paragonResolverEventHandlers } from "./resolver.js";

export const paragonModule = defineNativeModule({
  id: "Paragon",
  data: createWarriorModuleData("Paragon", {
    skillMechanics: PARAGON_SKILL_MECHANICS,
    handlers: paragonSkillHandlers,
  }),
  state: { scheduler: paragonState.create, resolver: paragonState.create },
  mechanics: {
    modifiers: paragonAttributeRules,
    schedulerHooks: paragonSchedulerHooks,
    resolverHooks: { eventHandlers: paragonResolverEventHandlers },
  },
  presentation: paragonUi,
});
