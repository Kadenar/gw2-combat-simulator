import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { mesmerModuleCatalog } from "../../catalog.js";
import { mirageSkillHandlers } from "./handlers.js";
import {
  mirageAttributeRules,
  mirageCastRules,
  mirageSchedulerHooks,
} from "./rules.js";
import {
  createMirageResolverState,
  createMirageState,
} from "./state.js";
import { mirageUi } from "./ui.js";
import type { MesmerMirageState } from "../../types.js";

export const mirageModule = defineProfessionModule<MesmerMirageState>({
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
  castRules: mirageCastRules,
  schedulerHooks: mirageSchedulerHooks,
  ui: mirageUi,
});
