import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";
import { guardianModuleCatalog } from "../../catalog.js";
import { willbenderEventReactions } from "./handlers.js";
import { createWillbenderState } from "./state.js";
import { willbenderUi } from "./ui.js";

export const willbenderModule = defineProfessionModule<SchedulerRecord>({
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
