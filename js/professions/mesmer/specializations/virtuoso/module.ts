import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { virtuosoAttributeRules, virtuosoRuntimeHooks } from "./rules.js";
import { createVirtuosoResolverState, createVirtuosoState } from "./state.js";
import { virtuosoUi } from "./ui.js";
import type { MesmerVirtuosoState } from "../../types.js";

export const virtuosoModule = defineProfessionModule<MesmerVirtuosoState>({
  id: "Virtuoso",
  catalog: mesmerModuleCatalog("Virtuoso"),
  resources: {
    createProfessionState: createVirtuosoState,
    createResolverState: createVirtuosoResolverState,
  },
  attributeRules: virtuosoAttributeRules,
  schedulerHooks: virtuosoRuntimeHooks,
  ui: virtuosoUi,
});
