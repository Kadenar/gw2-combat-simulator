import { defineProfessionModule } from "../../../../platform/engine/profession.js";
import { engineerModuleCatalog } from "../../catalog.js";
import {
  holosmithEventHandlers,
  holosmithSchedulerHooks,
  holosmithSkillHandlers,
} from "./handlers.js";
import {
  holosmithAttributeRules,
  holosmithCastRules,
} from "./rules.js";
import { createHolosmithState } from "./state.js";
import { holosmithUi } from "./ui.js";
import type { HolosmithState } from "../../types.js";

export const holosmithModule = defineProfessionModule<HolosmithState>({
  id: "Holosmith",
  catalog: {
    ...engineerModuleCatalog("Holosmith"),
    skillHandlers: holosmithSkillHandlers,
  },
  resources: {
    createProfessionState: createHolosmithState,
    createResolverState: createHolosmithState,
  },
  attributeRules: holosmithAttributeRules,
  castRules: holosmithCastRules,
  schedulerHooks: holosmithSchedulerHooks,
  resolverHooks: {
    eventHandlers: holosmithEventHandlers,
  },
  ui: holosmithUi,
});
