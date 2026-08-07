import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createMesmerModuleData } from "../../catalog-data.js";
import { troubadourAttributeRules, troubadourSchedulerHooks } from "./rules.js";
import { troubadourEventHandlers } from "./resolver.js";
import {
  createTroubadourResolverState,
  createTroubadourState,
} from "./state.js";
import { troubadourUi } from "./ui.js";
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./skills.js";
import { troubadourSkillHandlers } from "./handlers.js";

export const troubadourModule =
  defineNativeModule({
  id: "Troubadour",
  data: createMesmerModuleData("Troubadour", {
    skillMechanics: MESMER_TROUBADOUR_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_TROUBADOUR_EXTRA_SKILLS,
    handlers: troubadourSkillHandlers,
  }),
  state: {
    scheduler: createTroubadourState,
    resolver: createTroubadourResolverState,
  },
  mechanics: {
    modifiers: troubadourAttributeRules,
    schedulerHooks: troubadourSchedulerHooks,
    resolverHooks: { eventHandlers: troubadourEventHandlers },
  },
  presentation: troubadourUi,
  });
