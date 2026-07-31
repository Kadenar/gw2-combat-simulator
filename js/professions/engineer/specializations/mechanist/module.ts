import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../../catalog.js";
import {
  mechanistEventReactions,
  mechanistSchedulerHooks,
  mechanistSkillHandlers,
} from "./handlers.js";
import {
  mechanistAttributeRules,
  mechanistCastRules,
} from "./rules.js";
import { createMechanistState } from "./state.js";
import { mechanistUi } from "./ui.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";

export const mechanistModule = defineProfessionModule<SchedulerRecord>({
  id: "Mechanist",
  catalog: {
    ...engineerModuleCatalog("Mechanist"),
    skillHandlers: mechanistSkillHandlers,
  },
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
