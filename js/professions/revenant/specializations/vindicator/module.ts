import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { revenantModuleCatalog } from "../../catalog.js";
import {
  vindicatorEventHandlers,
  vindicatorEventReactions,
  vindicatorSkillHandlers,
} from "./handlers.js";
import {
  vindicatorAttributeRules,
  vindicatorCastRules,
  vindicatorSchedulerHooks,
} from "./rules.js";
import { createVindicatorState } from "./state.js";
import { vindicatorUi } from "./ui.js";

export const vindicatorModule = defineProfessionModule<SchedulerRecord>({
  id: "Vindicator",
  catalog: {
    ...revenantModuleCatalog("Vindicator"),
    skillHandlers: vindicatorSkillHandlers,
  },
  resources: {
    createProfessionState: createVindicatorState,
    createResolverState: createVindicatorState,
  },
  attributeRules: vindicatorAttributeRules,
  castRules: vindicatorCastRules,
  schedulerHooks: vindicatorSchedulerHooks,
  resolverHooks: {
    eventHandlers: vindicatorEventHandlers,
    eventReactions: vindicatorEventReactions,
  },
  ui: vindicatorUi,
});
