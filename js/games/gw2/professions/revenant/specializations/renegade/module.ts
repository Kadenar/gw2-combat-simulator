import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { renegadeAttributeRules } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-rules.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { renegadeUi } from '#gw2/professions/revenant/specializations/renegade/presentation.js';
import { RENEGADE_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/index.js';
import { RENEGADE_EXTRA_SKILLS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import { RENEGADE_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeHooks } from '#gw2/professions/revenant/specializations/renegade/hooks.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const renegadeModule = defineNativeModule({
  id: 'Renegade',
  data: createRevenantModuleData('Renegade', {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    extraSkills: RENEGADE_EXTRA_SKILLS,
    balanceProfiles: RENEGADE_BALANCE_PROFILES
  }),
  state: { create: renegadeState.create },
  modifiers: renegadeAttributeRules,
  hooks: renegadeHooks,
  presentation: renegadeUi
});
