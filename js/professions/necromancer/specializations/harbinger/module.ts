import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import {
  harbingerEventReactions,
  harbingerSchedulerHooks,
  harbingerSkillHandlers,
} from "./handlers.js";
import {
  harbingerAttributeRules,
  harbingerCastRules,
} from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createHarbingerState } from "./state.js";
import { harbingerUi } from "./ui.js";

export const harbingerModule = defineProfessionModule<SchedulerRecord>({
  id: "Harbinger",
  catalog: {
    ...necromancerModuleCatalog("Harbinger"),
    skillHandlers: harbingerSkillHandlers,
  },
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
