import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../../catalog.js";
import {
  amalgamEventReactions,
  amalgamSchedulerHooks,
  amalgamSkillHandlers,
} from "./handlers.js";
import {
  amalgamAttributeRules,
  amalgamCastRules,
} from "./rules.js";
import { createAmalgamState } from "./state.js";
import { amalgamUi } from "./ui.js";
import type { AmalgamState } from "../../types.js";

export const amalgamModule = defineProfessionModule<AmalgamState>({
  id: "Amalgam",
  catalog: {
    ...engineerModuleCatalog("Amalgam"),
    skillHandlers: amalgamSkillHandlers,
  },
  resources: {
    createProfessionState: createAmalgamState,
    createResolverState: createAmalgamState,
  },
  attributeRules: amalgamAttributeRules,
  castRules: amalgamCastRules,
  schedulerHooks: amalgamSchedulerHooks,
  resolverHooks: {
    eventReactions: amalgamEventReactions,
  },
  ui: amalgamUi,
});
