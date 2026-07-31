import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { chronomancerSkillHandlers } from "./handlers.js";
import {
  chronomancerAttributeRules,
  chronomancerRuntimeHooks,
} from "./rules.js";
import {
  createChronomancerResolverState,
  createChronomancerState,
} from "./state.js";
import { chronomancerUi } from "./ui.js";
import type { SchedulerRecord } from "../../../../platform/engine/types.js";

export const chronomancerModule = defineProfessionModule<SchedulerRecord>({
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
  schedulerHooks: chronomancerRuntimeHooks,
  ui: chronomancerUi,
});
