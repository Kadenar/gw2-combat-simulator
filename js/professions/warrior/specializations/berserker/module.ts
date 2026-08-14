import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../../catalog-data.js";
import { BERSERKER_SKILL_MECHANICS } from "./skills.js";
import { berserkerSkillHandlers } from "./handlers.js";
import {
  berserkerAttributeRules,
  berserkerCastRules,
  berserkerSchedulerHooks,
} from "./rules.js";
import { berserkerState } from "./state.js";
import { berserkerUi } from "./ui.js";
import { berserkerReactions } from "./resolver.js";

export const berserkerModule = defineNativeModule({
  id: "Berserker",
  data: createWarriorModuleData("Berserker", {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    handlers: berserkerSkillHandlers,
  }),
  state: { scheduler: berserkerState.create, resolver: berserkerState.create },
  mechanics: {
    modifiers: berserkerAttributeRules,
    castRules: berserkerCastRules,
    schedulerHooks: berserkerSchedulerHooks,
    reactions: berserkerReactions,
  },
  presentation: berserkerUi,
});
