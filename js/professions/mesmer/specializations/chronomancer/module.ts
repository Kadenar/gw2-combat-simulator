import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createMesmerModuleData } from "../../catalog-data.js";
import {
  chronomancerAttributeRules,
  chronomancerCastRules,
  chronomancerRuntimeHooks,
} from "./rules.js";
import { createChronomancerResolverState, chronomancerState } from "./state.js";
import { chronomancerUi } from "./ui.js";
import {
  MESMER_CHRONOMANCER_EXTRA_SKILLS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./skills.js";
import { chronomancerSkillHandlers } from "./handlers.js";
import { chronomancerEventHandlers } from "./resolver.js";
import { CHRONOMANCER_BALANCE_PROFILES } from "./profiles.js";

export const chronomancerModule = defineNativeModule({
  id: "Chronomancer",
  data: createMesmerModuleData("Chronomancer", {
    skillMechanics: MESMER_CHRONOMANCER_SKILL_MECHANICS,
    supplementalSkillMechanics:
      MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CHRONOMANCER_EXTRA_SKILLS,
    balanceProfiles: CHRONOMANCER_BALANCE_PROFILES,
    handlers: chronomancerSkillHandlers,
  }),
  state: {
    scheduler: chronomancerState.create,
    resolver: createChronomancerResolverState,
  },
  mechanics: {
    modifiers: chronomancerAttributeRules,
    castRules: chronomancerCastRules,
    schedulerHooks: chronomancerRuntimeHooks,
    resolverHooks: { eventHandlers: chronomancerEventHandlers },
  },
  presentation: chronomancerUi,
});
