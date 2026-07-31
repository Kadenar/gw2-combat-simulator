import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { thiefModuleCatalog } from "../../catalog.js";
import {
  specterSchedulerHooks,
  specterSkillHandlers,
} from "./handlers.js";
import {
  specterAttributeRules,
  specterCastRules,
} from "./rules.js";
import { createSpecterState } from "./state.js";
import { specterUi } from "./ui.js";

export const specterModule = defineProfessionModule({
  id: "Specter",
  catalog: {
    ...thiefModuleCatalog("Specter"),
    skillHandlers: specterSkillHandlers,
  },
  resources: {
    createProfessionState: createSpecterState,
    createResolverState: createSpecterState,
  },
  attributeRules: specterAttributeRules,
  castRules: specterCastRules,
  schedulerHooks: specterSchedulerHooks,
  ui: specterUi,
});
