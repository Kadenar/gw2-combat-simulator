import {
  defineProfessionModule,
} from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { mirageSkillHandlers } from "./handlers.js";
import {
  mirageAttributeRules,
  mirageSchedulerHooks,
} from "./rules.js";
import {
  createMirageResolverState,
  createMirageState,
} from "./state.js";
import { mirageUi } from "./ui.js";
import type {
  SchedulerRecord,
} from "../../../../platform/engine/types.js";

export const mirageModule = defineProfessionModule<SchedulerRecord>({
  id: "Mirage",
  catalog: {
    ...mesmerModuleCatalog("Mirage"),
    skillHandlers: mirageSkillHandlers,
  },
  resources: {
    createProfessionState: createMirageState,
    createResolverState: createMirageResolverState,
  },
  attributeRules: mirageAttributeRules,
  schedulerHooks: mirageSchedulerHooks,
  ui: mirageUi,
});
