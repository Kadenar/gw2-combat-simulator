import {
  defineNativeModule,
  onConditionApplied,
  onResolvedDamage,
} from "../../../platform/gw2/native-profession.js";
import { createEngineerModuleData } from "../catalog-data.js";
import { ENGINEER_SKILL_IDS as ID } from "../data/ids.js";
import { engineerCoreSkillHandlers } from "./handlers.js";
import {
  engineerCoreAttributeRules,
  engineerCoreCastRules,
  engineerCoreSchedulerHooks,
  snapshotEngineerState,
} from "./rules.js";
import {
  engineerCoreResolverEventHandlers,
  engineerCoreResolverEventReactions,
} from "./resolver.js";
import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS,
} from "./skills.js";
import { createEngineerCoreState, projectEngineerEndState } from "./state.js";
import { bindEngineerCoreUi } from "./ui.js";
import type { EngineerSchedulerContext } from "../types.js";

export const engineerCoreModule = defineNativeModule({
  id: "Core",
  data: createEngineerModuleData("Core", {
    skillMechanics: ENGINEER_CORE_SKILL_MECHANICS,
    extraSkills: ENGINEER_CORE_EXTRA_SKILLS,
    handlers: engineerCoreSkillHandlers,
    autoattackChains: { excludeSkillIds: [ID.RIFLE_BURST_GRENADE] },
  }),
  state: {
    scheduler: createEngineerCoreState,
    resolver: createEngineerCoreState,
    project: projectEngineerEndState,
  },
  mechanics: {
    modifiers: engineerCoreAttributeRules,
    castRules: engineerCoreCastRules,
    schedulerHooks: {
      ...engineerCoreSchedulerHooks,
      snapshot: (context: EngineerSchedulerContext) =>
        snapshotEngineerState(context.state.profession),
    },
    reactions: [
      onResolvedDamage({
        id: "engineer.core.damage",
        handler: engineerCoreResolverEventReactions.damage,
      }),
      onConditionApplied({
        id: "engineer.core.condition",
        handler: engineerCoreResolverEventReactions.condition,
      }),
    ],
    resolverHooks: {
      eventHandlers: engineerCoreResolverEventHandlers,
    },
  },
  presentation: bindEngineerCoreUi,
});
