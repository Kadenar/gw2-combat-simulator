import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../../catalog.js";
import {
  mechanistEventReactions,
  mechanistSchedulerHooks,
} from "./handlers.js";
import {
  mechanistAttributeRules,
  mechanistCastRules,
} from "./rules.js";
import { createMechanistState } from "./state.js";
import { mechanistUi } from "./ui.js";
import type { MechanistState } from "../../types.js";

export const mechanistModule = defineProfessionModule<MechanistState>({
  id: "Mechanist",
  catalog: engineerModuleCatalog("Mechanist"),
  resources: {
    createProfessionState: createMechanistState,
    createResolverState: createMechanistState,
  },
  attributeRules: mechanistAttributeRules,
  castRules: mechanistCastRules,
  schedulerHooks: mechanistSchedulerHooks,
  resolverHooks: {
    eventReactions: mechanistEventReactions,
  },
  ui: mechanistUi,
});
