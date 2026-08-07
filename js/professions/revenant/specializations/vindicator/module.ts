import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  vindicatorEventHandlers,
  vindicatorEventReactions,
} from "./handlers.js";
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks,
} from "./rules.js";
import { createVindicatorState } from "./state.js";
import { vindicatorUi } from "./ui.js";
import type { VindicatorState } from "../../types.js";

export const vindicatorModule = defineProfessionModule<VindicatorState>({
  id: "Vindicator",
  catalog: revenantModuleCatalog("Vindicator"),
  resources: {
    createProfessionState: createVindicatorState,
    createResolverState: createVindicatorState,
  },
  attributeRules: vindicatorAttributeRules,
  castRules: vindicatorCastRules,
  schedulerHooks: vindicatorSchedulerHooks,
  resolverHooks: {
    eventHandlers: vindicatorEventHandlers,
    eventReactions: vindicatorEventReactions,
  },
  ui: vindicatorUi,
});
