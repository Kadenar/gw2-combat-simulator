import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
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

export const renegadeModule = defineProfessionModule<SchedulerRecord>({
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
