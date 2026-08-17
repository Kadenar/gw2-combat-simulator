import { defineNativeModule } from "../../../../platform/gw2/native-profession.js";
import { createMesmerModuleData } from "../../catalog-data.js";
import { virtuosoAttributeRules, virtuosoRuntimeHooks } from "./rules.js";
import { createVirtuosoResolverState, virtuosoState } from "./state.js";
import { virtuosoUi } from "./ui.js";
import {
  MESMER_VIRTUOSO_EXTRA_SKILLS,
  MESMER_VIRTUOSO_SKILL_MECHANICS,
  MESMER_VIRTUOSO_SUPPLEMENTAL_SKILL_MECHANICS,
} from "./skills.js";
import { virtuosoSkillHandlers } from "./handlers.js";
import { VIRTUOSO_BALANCE_PROFILES } from "./profiles.js";

export const virtuosoModule = defineNativeModule({
  id: "Virtuoso",
  data: createMesmerModuleData("Virtuoso", {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_VIRTUOSO_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_VIRTUOSO_EXTRA_SKILLS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES,
    handlers: virtuosoSkillHandlers,
  }),
  state: {
    scheduler: virtuosoState.create,
    resolver: createVirtuosoResolverState,
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    schedulerHooks: virtuosoRuntimeHooks,
  },
  presentation: virtuosoUi,
});
