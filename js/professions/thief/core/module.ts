import {
  defineNativeModule,
  onBuffApplied,
  onConditionApplied,
  onResolvedDamage,
  onResolvedPlayerCriticalHit,
} from "../../../platform/gw2/native-profession.js";
import { createThiefModuleData } from "../catalog-data.js";
import {
  reactToThiefCoreBuff,
  thiefCoreCriticalReactions,
  thiefCoreResolverEventHandlers,
  thiefCoreResolverEventReactions,
} from "./resolver.js";
import {
  thiefCoreAttributeRules,
  thiefCoreCastRules,
  thiefCoreSchedulerHooks,
} from "./rules.js";
import { createThiefCoreState, projectThiefEndState } from "./state.js";
import { thiefCoreUi } from "./ui.js";
import {
  THIEF_CORE_EXTRA_SKILLS,
  THIEF_CORE_SKILL_MECHANICS,
} from "./skills.js";
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
    reactions: [
      onResolvedPlayerCriticalHit(
        thiefCoreCriticalReactions.unrelentingStrikes,
      ),
      onResolvedPlayerCriticalHit(thiefCoreCriticalReactions.noQuarter),
      onResolvedDamage({
        id: "thief.core.damage",
        order: 30,
        handler: thiefCoreResolverEventReactions.damage,
      }),
      onConditionApplied({
        id: "thief.core.condition",
        handler: thiefCoreResolverEventReactions.condition,
      }),
      onBuffApplied({
        id: "thief.core.buff",
        order: 30,
        handler: reactToThiefCoreBuff,
      }),
    ],
    resolverHooks: {
      eventHandlers: thiefCoreResolverEventHandlers,
    },
  },
  presentation: thiefCoreUi,
});
