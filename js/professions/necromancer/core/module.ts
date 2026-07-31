import { defineProfessionModule } from "../../../platform/engine/profession.js";
import {
  necromancerCoreAttributeRules,
  necromancerCoreCastRules,
  necromancerSchedulerHooks,
} from "./rules.js";
import {
  necromancerCoreEventHandlers,
  necromancerCoreEventReactions,
  necromancerCoreSkillHandlers,
} from "./handlers.js";
import { necromancerModuleCatalog } from "../catalog.js";
import {
  createNecromancerCoreState,
  projectNecromancerEndState,
  snapshotNecromancerState,
} from "./state.js";
import { necromancerCoreUi } from "./ui.js";
import type {
  NecromancerCoreState,
  NecromancerSchedulerContext,
} from "../types.js";

export const necromancerCoreModule =
  defineProfessionModule<NecromancerCoreState>({
  id: "Core",
  catalog: {
    ...necromancerModuleCatalog("Core"),
    skillHandlers: necromancerCoreSkillHandlers,
  },
  resources: {
    createProfessionState: createNecromancerCoreState,
    createResolverState: createNecromancerCoreState,
    projectEndState: projectNecromancerEndState,
  },
  attributeRules: necromancerCoreAttributeRules,
  castRules: necromancerCoreCastRules,
  schedulerHooks: {
    ...necromancerSchedulerHooks,
    snapshot: (context: NecromancerSchedulerContext) =>
      snapshotNecromancerState(context.state.profession),
  },
  resolverHooks: {
    eventHandlers: necromancerCoreEventHandlers,
    eventReactions: necromancerCoreEventReactions,
  },
  ui: necromancerCoreUi,
  });
