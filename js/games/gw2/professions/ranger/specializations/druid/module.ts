import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { druidModifiers } from '#gw2/professions/ranger/specializations/druid/modifiers.js';
import { druidHooks } from '#gw2/professions/ranger/specializations/druid/hooks.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { DRUID_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const druidModule = defineNativeModule({
  id: 'Druid',
  data: createRangerModuleData('Druid', {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    balanceProfiles: DRUID_BALANCE_PROFILES
  }),
  state: { create: druidState.create },
  modifiers: druidModifiers,
  hooks: druidHooks,
  presentation: bindDruidUi
});
