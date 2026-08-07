import { defineNativeModule } from "../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../catalog-data.js";
import {
  thiefCoreResolverEventHandlers,
  thiefCoreResolverEventReactions,
} from "./resolver.js";
import {
  thiefCoreAttributeRules,
  thiefCoreCastRules,
  thiefCoreSchedulerHooks,
} from "./rules.js";
import {
  createThiefCoreState,
  projectThiefEndState,
} from "./state.js";
import { thiefCoreUi } from "./ui.js";
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from "./skills.js";
import { thiefCoreSkillHandlers } from "./handlers.js";

export const thiefCoreModule = defineNativeModule({
  id: "Core",
  data: createThiefModuleData("Core", {
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    extraSkills: THIEF_CORE_EXTRA_SKILLS,
    handlers: thiefCoreSkillHandlers,
  }),
  state: {
    scheduler: createThiefCoreState,
    resolver: createThiefCoreState,
    project: projectThiefEndState,
  },
  mechanics: {
    modifiers: thiefCoreAttributeRules,
    castRules: thiefCoreCastRules,
    schedulerHooks: thiefCoreSchedulerHooks,
    resolverHooks: {
      eventHandlers: thiefCoreResolverEventHandlers,
      eventReactions: thiefCoreResolverEventReactions,
    },
  },
  presentation: thiefCoreUi,
});
