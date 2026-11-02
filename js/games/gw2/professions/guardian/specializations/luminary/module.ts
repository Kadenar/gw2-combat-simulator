import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import { LUMINARY_SKILL_FIELDS } from '#gw2/professions/guardian/specializations/luminary/catalog-fields.js';
import { luminaryHooks } from '#gw2/professions/guardian/specializations/luminary/hooks.js';
import { luminaryStanceModifiers } from '#gw2/professions/guardian/specializations/luminary/mechanics/effects.js';
import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import { GUARDIAN_LUMINARY_SKILL_FLIPS } from '#gw2/professions/guardian/specializations/luminary/skills/skill-flips.js';
import {
  luminaryState,
  projectLuminaryPlanningState
} from '#gw2/professions/guardian/specializations/luminary/state.js';
import { luminaryTraits } from '#gw2/professions/guardian/specializations/luminary/traits/index.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createNativeModuleData<GuardianSkill>({
    id: 'Luminary',
    traitLines: TRAIT_LINES,
    skillFlips: GUARDIAN_LUMINARY_SKILL_FLIPS,
    skillFields: LUMINARY_SKILL_FIELDS,
    skills: materializeSkillDefinitions(LUMINARY_SKILL_MECHANICS)
  }),
  state: { create: luminaryState.create, project: projectLuminaryPlanningState },
  // Stance rules precede weapon rules when their authored order ties.
  modifiers: luminaryStanceModifiers,
  traitDefinitions: luminaryTraits,
  hooks: luminaryHooks,
  presentation: bindLuminaryUi
});
