import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import {
  scourgeEventReactions,
  scourgeSkillHandlers,
} from "./handlers.js";
import {
  scourgeAttributeRules,
  scourgeCastRules,
} from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createScourgeState } from "./state.js";
import { scourgeUi } from "./ui.js";

export const scourgeModule = defineProfessionModule<SchedulerRecord>({
  id: "Scourge",
  catalog: {
    ...necromancerModuleCatalog("Scourge"),
    skillHandlers: scourgeSkillHandlers,
  },
  resources: {
    createProfessionState: createScourgeState,
    createResolverState: createScourgeState,
  },
  attributeRules: scourgeAttributeRules,
  castRules: scourgeCastRules,
  resolverHooks: {
    eventReactions: scourgeEventReactions,
  },
  ui: scourgeUi,
});
