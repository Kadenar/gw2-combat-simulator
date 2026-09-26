import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { scrapperAttributeRules } from '#gw2/professions/engineer/specializations/scrapper/traits/modifiers.js';
import { scrapperLive } from '#gw2/professions/engineer/specializations/scrapper/live.js';
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
  mechanics: {
    modifiers: scrapperAttributeRules,
    live: scrapperLive
  },
  presentation: bindScrapperUi
});
