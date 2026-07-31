import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import {
  ritualistEventHandlers,
  ritualistEventReactions,
  ritualistSchedulerHooks,
  ritualistSkillHandlers,
} from "./handlers.js";
import { ritualistAttributeRules } from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createRitualistState } from "./state.js";
import { ritualistUi } from "./ui.js";

export const ritualistModule = defineProfessionModule<SchedulerRecord>({
  id: "Ritualist",
  catalog: {
    ...necromancerModuleCatalog("Ritualist"),
    skillHandlers: ritualistSkillHandlers,
  },
  resources: {
    createProfessionState: createRitualistState,
    createResolverState: createRitualistState,
  },
  attributeRules: ritualistAttributeRules,
  resolverHooks: {
    eventHandlers: ritualistEventHandlers,
    eventReactions: ritualistEventReactions,
  },
  schedulerHooks: ritualistSchedulerHooks,
  ui: ritualistUi,
});
