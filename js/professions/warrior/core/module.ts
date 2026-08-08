import { defineNativeModule } from "../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../catalog-data.js";
import { WARRIOR_CORE_SKILL_MECHANICS } from "./skills.js";
import { warriorCoreSkillHandlers } from "./handlers.js";
import {
  warriorCoreAttributeRules,
  warriorCoreCastRules,
  warriorCoreSchedulerHooks,
} from "./rules.js";
import {
  createWarriorCoreState,
  projectWarriorEndState,
  snapshotWarriorState,
} from "./state.js";
import { bindWarriorCoreUi } from "./ui.js";
import type { WarriorSchedulerContext } from "../types.js";
import { WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS } from "./actions.js";

export const warriorCoreModule = defineNativeModule({
  id: "Core",
  data: createWarriorModuleData("Core", {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS],
    handlers: warriorCoreSkillHandlers,
  }),
  state: {
    scheduler: createWarriorCoreState,
    resolver: createWarriorCoreState,
    project: projectWarriorEndState,
  },
  mechanics: {
    modifiers: warriorCoreAttributeRules,
    castRules: warriorCoreCastRules,
    schedulerHooks: {
      ...warriorCoreSchedulerHooks,
      snapshot: (context: WarriorSchedulerContext) =>
        snapshotWarriorState(context.state.profession),
    },
  },
  presentation: bindWarriorCoreUi,
});
