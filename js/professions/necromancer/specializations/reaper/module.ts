import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import {
  reaperEventReactions,
  reaperSchedulerHooks,
  reaperSkillHandlers,
} from "./handlers.js";
import {
  reaperAttributeRules,
  reaperCastRules,
} from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createReaperState } from "./state.js";
import { reaperUi } from "./ui.js";
import type { ReaperState } from "../../types.js";

export const reaperModule = defineProfessionModule<ReaperState>({
  id: "Reaper",
  catalog: {
    ...necromancerModuleCatalog("Reaper"),
    skillHandlers: reaperSkillHandlers,
  },
  resources: {
    createProfessionState: createReaperState,
    createResolverState: createReaperState,
  },
  attributeRules: reaperAttributeRules,
  castRules: reaperCastRules,
  resolverHooks: {
    eventReactions: reaperEventReactions,
  },
  schedulerHooks: reaperSchedulerHooks,
  ui: reaperUi,
});
