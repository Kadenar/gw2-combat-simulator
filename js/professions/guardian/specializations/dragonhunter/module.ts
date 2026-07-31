import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { guardianModuleCatalog } from "../../catalog.js";
import { dragonhunterEventReactions } from "./handlers.js";
import { createDragonhunterState } from "./state.js";
import { dragonhunterUi } from "./ui.js";

export const dragonhunterModule =
  defineProfessionModule<Record<string, never>>({
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
