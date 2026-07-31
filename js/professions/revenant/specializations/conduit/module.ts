import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  conduitEventHandlers,
  conduitEventReactions,
  conduitSkillHandlers,
} from "./handlers.js";
import {
  conduitAttributeRules,
  conduitCastRules,
  conduitSchedulerHooks,
} from "./rules.js";
import { createConduitState } from "./state.js";
import { conduitUi } from "./ui.js";

export const conduitModule = defineProfessionModule<SchedulerRecord>({
  id: "Conduit",
  catalog: {
    ...revenantModuleCatalog("Conduit"),
    skillHandlers: conduitSkillHandlers,
  },
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
