import { defineProfessionModule } from "../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../platform/engine/types.js";
import { revenantModuleCatalog } from "../catalog.js";
import {
  revenantCoreEventHandlers,
  revenantCoreEventReactions,
  revenantCoreSkillHandlers,
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
import type { RevenantSchedulerContext } from "../types.js";

export const revenantCoreModule = defineProfessionModule<SchedulerRecord>({
  id: "Core",
  catalog: {
    ...revenantModuleCatalog("Core"),
    skillHandlers: revenantCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createRevenantCoreState,
    createResolverState: createRevenantCoreState,
    projectEndState: projectRevenantEndState,
  },
  attributeRules: revenantCoreAttributeRules,
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
  ui: revenantCoreUi,
});
