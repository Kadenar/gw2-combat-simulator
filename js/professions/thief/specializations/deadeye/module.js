import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { thiefModuleCatalog } from "../../catalog.js";
import {
  deadeyeSchedulerHooks,
} from "./handlers.js";
import {
  deadeyeAttributeRules,
  deadeyeCastRules,
} from "./rules.js";
import { createDeadeyeState } from "./state.js";
import { deadeyeUi } from "./ui.js";

export const deadeyeModule = defineProfessionModule({
  id: "Deadeye",
  catalog: thiefModuleCatalog("Deadeye"),
  resources: {
    createProfessionState: createDeadeyeState,
    createResolverState: createDeadeyeState,
  },
  attributeRules: deadeyeAttributeRules,
  castRules: deadeyeCastRules,
  schedulerHooks: deadeyeSchedulerHooks,
  ui: deadeyeUi,
});
