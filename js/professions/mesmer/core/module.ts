import { defineProfessionModule } from "../../../platform/engine/profession.js";
import { mesmerCoreAttributeRules } from "./attribute-rules.js";
import { mesmerModuleCatalog } from "../catalog.js";
import { mesmerCoreSkillHandlers } from "./handlers.js";
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
import type {
  MesmerCoreState,
  MesmerSchedulerContext,
} from "../types.js";

export const mesmerCoreModule = defineProfessionModule<MesmerCoreState>({
  id: "Core",
  catalog: {
    ...mesmerModuleCatalog("Core"),
    skillHandlers: mesmerCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createMesmerCoreState,
    createResolverState: createMesmerCoreResolverState,
    projectEndState: projectMesmerEndState,
  },
  attributeRules: mesmerCoreAttributeRules,
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
  ui: mesmerCoreUi,
});
