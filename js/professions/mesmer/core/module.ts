import { defineNativeModule } from "../../../platform/gw2/native-profession.js";
import { createMesmerModuleData } from "../catalog-data.js";
import { mesmerCoreAttributeRules } from "./attribute-rules.js";
import {
  mesmerCastRules,
  mesmerCoreSchedulerHooks,
  projectMesmerEndState,
} from "./rules.js";
import {
  mesmerCoreEventHandlers,
  mesmerCoreEventReactions,
} from "./resolver.js";
import {
  createMesmerCoreResolverState,
  createMesmerCoreState,
  snapshotMesmerState,
} from "./state.js";
import { mesmerCoreUi } from "./ui.js";
import {
  MESMER_CORE_EXTRA_SKILLS,
  MESMER_CORE_SKILL_MECHANICS,
  MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./skills.js";
import { mesmerCoreSkillHandlers } from "./handlers.js";
import type { MesmerSchedulerContext } from "../types.js";

export const mesmerCoreModule = defineNativeModule({
  id: "Core",
  data: createMesmerModuleData("Core", {
    skillMechanics: MESMER_CORE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CORE_EXTRA_SKILLS,
    handlers: mesmerCoreSkillHandlers,
  }),
  state: {
    scheduler: createMesmerCoreState,
    resolver: createMesmerCoreResolverState,
    project: projectMesmerEndState,
  },
  mechanics: {
    modifiers: mesmerCoreAttributeRules,
    castRules: mesmerCastRules,
    schedulerHooks: {
      ...mesmerCoreSchedulerHooks,
      snapshot: (context: MesmerSchedulerContext) =>
        snapshotMesmerState(context.state.profession),
    },
    resolverHooks: {
      eventHandlers: mesmerCoreEventHandlers,
      eventReactions: mesmerCoreEventReactions,
    },
  },
  presentation: mesmerCoreUi,
});
