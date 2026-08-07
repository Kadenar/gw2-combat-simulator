import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { GuardianFirebrandState } from "../../types.js";
import { guardianModuleCatalog } from "../../catalog.js";
import {
  firebrandEventHandlers,
  firebrandEventReactions,
} from "./handlers.js";
import {
  firebrandAttributeRules,
  firebrandCastRules,
  firebrandSchedulerHooks,
} from "./rules.js";
import { createFirebrandState } from "./state.js";
import { firebrandUi } from "./ui.js";

export const firebrandModule =
  defineProfessionModule<GuardianFirebrandState>({
  id: "Firebrand",
  catalog: guardianModuleCatalog("Firebrand"),
  resources: {
    createProfessionState: createFirebrandState,
    createResolverState: createFirebrandState,
  },
  attributeRules: firebrandAttributeRules,
  castRules: firebrandCastRules,
  schedulerHooks: firebrandSchedulerHooks,
  resolverHooks: {
    eventHandlers: firebrandEventHandlers,
    eventReactions: firebrandEventReactions,
  },
  ui: firebrandUi,
  });
