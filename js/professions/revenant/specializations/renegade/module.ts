import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  renegadeEventHandlers,
  renegadeEventReactions,
  renegadeSkillHandlers,
} from "./handlers.js";
import {
  renegadeAttributeRules,
  renegadeCastRules,
  renegadeSchedulerHooks,
} from "./rules.js";
import { createRenegadeState } from "./state.js";
import { renegadeUi } from "./ui.js";
import type { RenegadeState } from "../../types.js";

export const renegadeModule = defineProfessionModule<RenegadeState>({
  id: "Renegade",
  catalog: {
    ...revenantModuleCatalog("Renegade"),
    skillHandlers: renegadeSkillHandlers,
  },
  resources: {
    createProfessionState: createRenegadeState,
    createResolverState: createRenegadeState,
  },
  attributeRules: renegadeAttributeRules,
  castRules: renegadeCastRules,
  schedulerHooks: renegadeSchedulerHooks,
  resolverHooks: {
    eventHandlers: renegadeEventHandlers,
    eventReactions: renegadeEventReactions,
  },
  ui: renegadeUi,
});
