import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import {
  ritualistEventHandlers,
  ritualistEventReactions,
  ritualistSchedulerHooks,
} from "./handlers.js";
import { ritualistAttributeRules } from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createRitualistState } from "./state.js";
import { ritualistUi } from "./ui.js";
import type { RitualistState } from "../../types.js";

export const ritualistModule = defineProfessionModule<RitualistState>({
  id: "Ritualist",
  catalog: necromancerModuleCatalog("Ritualist"),
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
