import { defineProfessionModule } from "../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../catalog.js";
import {
  engineerCoreEventHandlers,
  engineerCoreEventReactions,
  engineerCoreSkillHandlers,
} from "./handlers.js";
import {
  engineerCoreAttributeRules,
  engineerCoreCastRules,
  engineerCoreSchedulerHooks,
} from "./rules.js";
import {
  createEngineerCoreState,
  projectEngineerEndState,
  snapshotEngineerState,
} from "./state.js";
import { engineerCoreUi } from "./ui.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type { EngineerSchedulerContext } from "../types.js";

export const engineerCoreModule = defineProfessionModule<SchedulerRecord>({
  id: "Core",
  catalog: {
    ...engineerModuleCatalog("Core"),
    skillHandlers: engineerCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createEngineerCoreState,
    createResolverState: createEngineerCoreState,
    projectEndState: projectEngineerEndState,
  },
  attributeRules: engineerCoreAttributeRules,
  castRules: engineerCoreCastRules,
  schedulerHooks: {
    ...engineerCoreSchedulerHooks,
    snapshot: (context: EngineerSchedulerContext) =>
      snapshotEngineerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: engineerCoreEventHandlers,
    eventReactions: engineerCoreEventReactions,
  },
  ui: engineerCoreUi,
});
