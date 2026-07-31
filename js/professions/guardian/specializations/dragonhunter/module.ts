import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { guardianModuleCatalog } from "../../catalog.js";
import { dragonhunterEventReactions } from "./handlers.js";
import { createDragonhunterState } from "./state.js";
import { dragonhunterUi } from "./ui.js";

export const dragonhunterModule = defineProfessionModule<SchedulerRecord>({
  id: "Dragonhunter",
  catalog: guardianModuleCatalog("Dragonhunter"),
  resources: {
    createProfessionState: createDragonhunterState,
    createResolverState: createDragonhunterState,
  },
  resolverHooks: {
    eventReactions: dragonhunterEventReactions,
  },
  ui: dragonhunterUi,
});
