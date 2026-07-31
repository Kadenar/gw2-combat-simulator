import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  heraldEventHandlers,
  heraldEventReactions,
  heraldSkillHandlers,
} from "./handlers.js";
import {
  heraldAttributeRules,
  heraldCastRules,
  heraldSchedulerHooks,
} from "./rules.js";
import { createHeraldState } from "./state.js";
import { heraldUi } from "./ui.js";
import type { HeraldState } from "../../types.js";

export const heraldModule = defineProfessionModule<HeraldState>({
  id: "Herald",
  catalog: {
    ...revenantModuleCatalog("Herald"),
    skillHandlers: heraldSkillHandlers,
  },
  resources: {
    createProfessionState: createHeraldState,
    createResolverState: createHeraldState,
  },
  attributeRules: heraldAttributeRules,
  castRules: heraldCastRules,
  schedulerHooks: heraldSchedulerHooks,
  resolverHooks: {
    eventHandlers: heraldEventHandlers,
    eventReactions: heraldEventReactions,
  },
  ui: heraldUi,
});
