import { defineNativeModule } from "../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../catalog-data.js";
import { rangerCoreSkillHandlers } from "./handlers.js";
import { rangerCoreAttributeRules, rangerCoreCastRules } from "./rules.js";
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS,
} from "./skills.js";
import { createRangerCoreState, projectRangerEndState } from "./state.js";
import { bindRangerCoreUi } from "./ui.js";

export const rangerCoreModule = defineNativeModule({
  id: "Core",
  data: createRangerModuleData("Core", {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: RANGER_CORE_EXTRA_SKILLS,
    handlers: rangerCoreSkillHandlers,
  }),
  state: {
    scheduler: createRangerCoreState,
    resolver: createRangerCoreState,
    project: projectRangerEndState,
  },
  mechanics: {
    modifiers: rangerCoreAttributeRules,
    castRules: rangerCoreCastRules,
  },
  presentation: bindRangerCoreUi,
});
