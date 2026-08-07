import { professionCoreState } from "../../../platform/engine/profession.js";
import { defineProfessionModule } from "../../../platform/engine/profession.js";
import { guardianModuleCatalog } from "../catalog.js";
import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions,
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
import type {
  GuardianCoreState,
  GuardianSchedulerContext,
} from "../types.js";

export const guardianCoreModule = defineProfessionModule<GuardianCoreState>({
  id: "Core",
  catalog: guardianModuleCatalog("Core"),
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
