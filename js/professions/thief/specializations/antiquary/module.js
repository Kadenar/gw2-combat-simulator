import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { thiefModuleCatalog } from "../../catalog.js";
import {
  antiquarySchedulerHooks,
} from "./handlers.js";
import { antiquaryResolverEventReactions } from "./resolver.js";
import {
  antiquaryAttributeRules,
  antiquaryCastRules,
} from "./rules.js";
import { createAntiquaryState } from "./state.js";
import { antiquaryUi } from "./ui.js";

export const antiquaryModule = defineProfessionModule({
  id: "Antiquary",
  catalog: thiefModuleCatalog("Antiquary"),
  resources: {
    createProfessionState: createAntiquaryState,
    createResolverState: createAntiquaryState,
  },
  attributeRules: antiquaryAttributeRules,
  castRules: antiquaryCastRules,
  schedulerHooks: antiquarySchedulerHooks,
  resolverHooks: {
    eventReactions: antiquaryResolverEventReactions,
  },
  ui: antiquaryUi,
});
