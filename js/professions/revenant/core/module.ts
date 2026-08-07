import { defineNativeModule } from "../../../platform/gw2/native-profession.js";
import { createRevenantModuleData } from "../catalog-data.js";
import {
  revenantCoreEventHandlers,
  revenantCoreEventReactions,
} from "./handlers.js";
import { revenantCoreAttributeRules } from "./attribute-rules.js";
import {
  revenantCastRules,
  revenantSchedulerHooks,
} from "./rules.js";
import {
  createRevenantCoreState,
  projectRevenantEndState,
  snapshotRevenantState,
} from "./state.js";
import { revenantCoreUi } from "./ui.js";
import { REVENANT_CORE_BASE_SKILL_MECHANICS, REVENANT_CORE_EXTRA_SKILLS } from "./skills.js";
import { revenantCoreSkillHandlers } from "./handlers.js";
import type { RevenantSchedulerContext } from "../types.js";

export const revenantCoreModule = defineNativeModule({
  id: "Core",
  data: createRevenantModuleData("Core", {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    handlers: revenantCoreSkillHandlers,
  }),
  state: {
    scheduler: createRevenantCoreState,
    resolver: createRevenantCoreState,
    project: projectRevenantEndState,
  },
  mechanics: {
    modifiers: revenantCoreAttributeRules,
    castRules: revenantCastRules,
    schedulerHooks: {
      ...revenantSchedulerHooks,
      snapshot: (context: RevenantSchedulerContext) =>
        snapshotRevenantState(context.state.profession),
    },
    resolverHooks: {
      eventHandlers: revenantCoreEventHandlers,
      eventReactions: revenantCoreEventReactions,
    },
  },
  presentation: revenantCoreUi,
});
