import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { guardianModuleCatalog } from "../../catalog.js";
import {
  luminaryEventHandlers,
  luminaryEventReactions,
  luminarySkillHandlers,
} from "./handlers.js";
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
} from "./rules.js";
import { createLuminaryState } from "./state.js";
import { luminaryUi } from "./ui.js";

export const luminaryModule = defineProfessionModule<SchedulerRecord>({
  id: "Luminary",
  catalog: {
    ...guardianModuleCatalog("Luminary"),
    skillHandlers: luminarySkillHandlers,
  },
  resources: {
    createProfessionState: createLuminaryState,
    createResolverState: createLuminaryState,
  },
  attributeRules: luminaryAttributeRules,
  castRules: luminaryCastRules,
  schedulerHooks: luminarySchedulerHooks,
  resolverHooks: {
    eventHandlers: luminaryEventHandlers,
    eventReactions: luminaryEventReactions,
  },
  ui: luminaryUi,
});
