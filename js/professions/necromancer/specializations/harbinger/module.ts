import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import {
  harbingerEventReactions,
  harbingerSchedulerHooks,
} from "./handlers.js";
import {
  harbingerAttributeRules,
  harbingerCastRules,
} from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createHarbingerState } from "./state.js";
import { harbingerUi } from "./ui.js";
import type { HarbingerState } from "../../types.js";

export const harbingerModule = defineProfessionModule<HarbingerState>({
  id: "Harbinger",
  catalog: necromancerModuleCatalog("Harbinger"),
  resources: {
    createProfessionState: createHarbingerState,
    createResolverState: createHarbingerState,
  },
  attributeRules: harbingerAttributeRules,
  castRules: harbingerCastRules,
  resolverHooks: {
    eventReactions: harbingerEventReactions,
  },
  schedulerHooks: harbingerSchedulerHooks,
  ui: harbingerUi,
});
