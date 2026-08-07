import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { GuardianLuminaryState } from "../../types.js";
import { guardianModuleCatalog } from "../../catalog.js";
import {
  luminaryEventHandlers,
  luminaryEventReactions,
} from "./handlers.js";
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
} from "./rules.js";
import { createLuminaryState } from "./state.js";
import { luminaryUi } from "./ui.js";

export const luminaryModule =
  defineProfessionModule<GuardianLuminaryState>({
  id: "Luminary",
  catalog: guardianModuleCatalog("Luminary"),
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
