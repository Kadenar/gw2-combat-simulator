import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { virtuosoSkillHandlers } from "./handlers.js";
import { virtuosoAttributeRules, virtuosoRuntimeHooks } from "./rules.js";
import { createVirtuosoResolverState, createVirtuosoState } from "./state.js";
import { virtuosoUi } from "./ui.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";

export const virtuosoModule = defineProfessionModule<SchedulerRecord>({
  id: "Virtuoso",
  catalog: {
    ...mesmerModuleCatalog("Virtuoso"),
    skillHandlers: virtuosoSkillHandlers,
  },
  resources: {
    createProfessionState: createVirtuosoState,
    createResolverState: createVirtuosoResolverState,
  },
  attributeRules: virtuosoAttributeRules,
  schedulerHooks: virtuosoRuntimeHooks,
  ui: virtuosoUi,
});
