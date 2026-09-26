import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { galeshotAttributeRules } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow-rules.js';
import { galeshotHooks } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import { GALESHOT_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/galeshot/skills/index.js';
import { GALESHOT_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/galeshot/profiles.js';
import { galeshotState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const galeshotModule = defineNativeModule({
  id: 'Galeshot',
  data: createRangerModuleData('Galeshot', {
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS,
    balanceProfiles: GALESHOT_BALANCE_PROFILES
  }),
  state: { create: galeshotState.create },
  modifiers: galeshotAttributeRules,
  hooks: galeshotHooks,
  presentation: bindGaleshotUi
});
