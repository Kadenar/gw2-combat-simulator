import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { thiefModuleCatalog } from "../../catalog.js";
import { daredevilSchedulerHooks } from "./handlers.js";
import { daredevilAttributeRules } from "./rules.js";
import { createDaredevilState } from "./state.js";

export const daredevilModule = defineProfessionModule({
  id: "Daredevil",
  catalog: thiefModuleCatalog("Daredevil"),
  resources: {
    createProfessionState: createDaredevilState,
    createResolverState: createDaredevilState,
  },
  attributeRules: daredevilAttributeRules,
  schedulerHooks: daredevilSchedulerHooks,
});
