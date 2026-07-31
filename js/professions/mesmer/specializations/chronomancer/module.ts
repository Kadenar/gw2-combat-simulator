import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { chronomancerSkillHandlers } from "./handlers.js";
import {
  chronomancerAttributeRules,
  chronomancerCastRules,
  chronomancerRuntimeHooks,
} from "./rules.js";
import {
  createChronomancerResolverState,
  createChronomancerState,
} from "./state.js";
import { chronomancerUi } from "./ui.js";
import type { MesmerChronomancerState } from "../../types.js";

export const chronomancerModule =
  defineProfessionModule<MesmerChronomancerState>({
  id: "Chronomancer",
  catalog: {
    ...mesmerModuleCatalog("Chronomancer"),
    skillHandlers: chronomancerSkillHandlers,
  },
  resources: {
    createProfessionState: createChronomancerState,
    createResolverState: createChronomancerResolverState,
  },
  attributeRules: chronomancerAttributeRules,
  castRules: chronomancerCastRules,
  schedulerHooks: chronomancerRuntimeHooks,
  ui: chronomancerUi,
  });
