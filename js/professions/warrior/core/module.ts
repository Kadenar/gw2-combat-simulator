import {
  defineNativeModule,
  onResolvedDamage,
} from "../../../platform/gw2/native-profession.js";
import { createWarriorModuleData } from "../catalog-data.js";
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
} from "./skills.js";
import { warriorCoreSkillHandlers } from "./handlers.js";
import {
  warriorCoreAttributeRules,
  warriorCoreCastRules,
  warriorCoreSchedulerHooks,
  snapshotWarriorState,
} from "./rules.js";
import { createWarriorCoreState, projectWarriorEndState } from "./state.js";
import { bindWarriorCoreUi } from "./ui.js";
import type { WarriorSchedulerContext } from "../types.js";
import { reactToWarriorBoonRemoval, reactToWarriorDamage } from "./resolver.js";

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
    resolverHooks: {
      eventHandlers: { "warrior.boon-removal": reactToWarriorBoonRemoval },
    },
    reactions: [
      onResolvedDamage({
        id: "warrior.core-damage",
        handler: reactToWarriorDamage,
      }),
    ],
  },
  presentation: bindWarriorCoreUi,
});
