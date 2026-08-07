import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createMesmerModuleData } from "../../catalog-data.js";
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
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./skills.js";
import { mirageSkillHandlers } from "./handlers.js";

export const mirageModule = defineNativeModule({
  id: "Mirage",
  data: createMesmerModuleData("Mirage", {
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS,
    handlers: mirageSkillHandlers,
  }),
  state: {
    scheduler: createMirageState,
    resolver: createMirageResolverState,
  },
  mechanics: {
    modifiers: mirageAttributeRules,
    castRules: mirageCastRules,
    schedulerHooks: mirageSchedulerHooks,
  },
  presentation: mirageUi,
});
