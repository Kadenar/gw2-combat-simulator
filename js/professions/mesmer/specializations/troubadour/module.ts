import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { troubadourSkillHandlers } from "./handlers.js";
import { troubadourAttributeRules, troubadourSchedulerHooks } from "./rules.js";
import { troubadourEventHandlers } from "./resolver.js";
import {
  createTroubadourResolverState,
  createTroubadourState,
} from "./state.js";
import { troubadourUi } from "./ui.js";
import type { MesmerTroubadourState } from "../../types.js";

export const troubadourModule =
  defineProfessionModule<MesmerTroubadourState>({
  id: "Troubadour",
  catalog: {
    ...mesmerModuleCatalog("Troubadour"),
    skillHandlers: troubadourSkillHandlers,
  },
  resources: {
    createProfessionState: createTroubadourState,
    createResolverState: createTroubadourResolverState,
  },
  attributeRules: troubadourAttributeRules,
  schedulerHooks: troubadourSchedulerHooks,
  resolverHooks: {
    eventHandlers: troubadourEventHandlers,
  },
  ui: troubadourUi,
  });
