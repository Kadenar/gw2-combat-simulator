import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
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

export const reaperModule = defineProfessionModule<SchedulerRecord>({
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
