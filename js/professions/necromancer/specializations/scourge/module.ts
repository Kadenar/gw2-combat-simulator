import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import {
  scourgeEventReactions,
} from "./handlers.js";
import {
  scourgeAttributeRules,
  scourgeCastRules,
} from "./rules.js";
import { necromancerModuleCatalog } from "../../catalog.js";
import { createScourgeState } from "./state.js";
import { scourgeUi } from "./ui.js";
import type { ScourgeState } from "../../types.js";

export const scourgeModule = defineProfessionModule<ScourgeState>({
  id: "Scourge",
  catalog: necromancerModuleCatalog("Scourge"),
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
