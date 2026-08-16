import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createRangerModuleData } from "../../catalog-data.js";
import { galeshotSkillHandlers } from "./handlers.js";
import {
  galeshotAttributeRules,
  galeshotCastRules,
  galeshotSchedulerHooks,
} from "./rules.js";
import { GALESHOT_BASE_SKILL_MECHANICS } from "./skills.js";
import { galeshotState } from "./state.js";
import { galeshotUi } from "./ui.js";
import { galeshotEventHandlers } from "./resolver.js";

export const galeshotModule = defineNativeModule({
  id: "Galeshot",
  data: createRangerModuleData("Galeshot", {
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS,
    handlers: galeshotSkillHandlers,
  }),
  // Both sides share the same factory; the resolver only needs the fields
  // emitted by handleGaleshotState, but reusing the full shape is harmless.
  state: { scheduler: galeshotState.create, resolver: galeshotState.create },
  mechanics: {
    modifiers: galeshotAttributeRules,
    castRules: galeshotCastRules,
    schedulerHooks: galeshotSchedulerHooks,
    resolverHooks: { eventHandlers: galeshotEventHandlers },
  },
  presentation: galeshotUi,
});
