import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { scrapperModifiers } from '#gw2/professions/engineer/specializations/scrapper/modifiers.js';
import { scrapperHooks } from '#gw2/professions/engineer/specializations/scrapper/hooks.js';
import { SCRAPPER_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/scrapper/skills/index.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { SCRAPPER_BALANCE_PROFILES } from '#gw2/professions/engineer/specializations/scrapper/profiles.js';
import { bindScrapperUi } from '#gw2/professions/engineer/specializations/scrapper/presentation.js';

export const scrapperModule = defineNativeModule({
  id: 'Scrapper',
  data: createEngineerModuleData('Scrapper', {
    skillMechanics: SCRAPPER_SKILL_MECHANICS,
    balanceProfiles: SCRAPPER_BALANCE_PROFILES
  }),
  // Scrapper traits share the live state with their actual combo and boon reactions.
  state: { create: scrapperState.create },
  modifiers: scrapperModifiers,
  hooks: scrapperHooks,
  presentation: bindScrapperUi
});
