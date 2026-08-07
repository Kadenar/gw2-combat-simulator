import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  conduitEventHandlers,
  conduitEventReactions,
} from "./handlers.js";
import {
  conduitAttributeRules,
  conduitCastRules,
  conduitSchedulerHooks,
} from "./rules.js";
import { createConduitState } from "./state.js";
import { conduitUi } from "./ui.js";
import type { ConduitState } from "../../types.js";

export const conduitModule = defineProfessionModule<ConduitState>({
  id: "Conduit",
  catalog: revenantModuleCatalog("Conduit"),
  resources: {
    createProfessionState: createConduitState,
    createResolverState: createConduitState,
  },
  attributeRules: conduitAttributeRules,
  castRules: conduitCastRules,
  schedulerHooks: conduitSchedulerHooks,
  resolverHooks: {
    eventHandlers: conduitEventHandlers,
    eventReactions: conduitEventReactions,
  },
  ui: conduitUi,
});
