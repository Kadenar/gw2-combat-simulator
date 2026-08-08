import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../../catalog-data.js";
import { SPELLBREAKER_SKILL_MECHANICS } from "./skills.js";
import {
  spellbreakerSkillHandlers,
  spellbreakerSchedulerHooks,
} from "./handlers.js";
import { spellbreakerAttributeRules } from "./rules.js";
import { spellbreakerState } from "./state.js";
import { spellbreakerUi } from "./ui.js";

export const spellbreakerModule = defineNativeModule({
  id: "Spellbreaker",
  data: createWarriorModuleData("Spellbreaker", {
    skillMechanics: SPELLBREAKER_SKILL_MECHANICS,
    handlers: spellbreakerSkillHandlers,
  }),
  state: {
    scheduler: spellbreakerState.create,
    resolver: spellbreakerState.create,
  },
  mechanics: {
    modifiers: spellbreakerAttributeRules,
    schedulerHooks: spellbreakerSchedulerHooks,
  },
  presentation: spellbreakerUi,
});
