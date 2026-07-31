import { defineProfessionModule } from "../../../platform/engine/profession.js";
import { guardianModuleCatalog } from "../catalog.js";
import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions,
  guardianCoreSkillHandlers,
} from "./handlers.js";
import {
  guardianCoreAttributeRules,
  guardianCoreCastRules,
  guardianCoreSchedulerHooks,
} from "./rules.js";
import {
  createGuardianCoreState,
  projectGuardianEndState,
  snapshotGuardianState,
} from "./state.js";
import { guardianCoreUi } from "./ui.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import type { GuardianSchedulerContext } from "../types.js";

export const guardianCoreModule = defineProfessionModule<SchedulerRecord>({
  id: "Core",
  catalog: {
    ...guardianModuleCatalog("Core"),
    skillHandlers: guardianCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createGuardianCoreState,
    createResolverState: createGuardianCoreState,
    projectEndState: projectGuardianEndState,
  },
  attributeRules: guardianCoreAttributeRules,
  castRules: guardianCoreCastRules,
  schedulerHooks: {
    ...guardianCoreSchedulerHooks,
    snapshot: (context: GuardianSchedulerContext) =>
      snapshotGuardianState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: guardianCoreEventHandlers,
    eventReactions: guardianCoreEventReactions,
  },
  ui: guardianCoreUi,
});
