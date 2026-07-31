import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { guardianModuleCatalog } from "../../catalog.js";
import { willbenderEventReactions } from "./handlers.js";
import { createWillbenderState } from "./state.js";
import { willbenderUi } from "./ui.js";

export const willbenderModule =
  defineProfessionModule<Record<string, never>>({
  id: "Willbender",
  catalog: guardianModuleCatalog("Willbender"),
  resources: {
    createProfessionState: createWillbenderState,
    createResolverState: createWillbenderState,
  },
  resolverHooks: {
    eventReactions: willbenderEventReactions,
  },
  ui: willbenderUi,
  });
