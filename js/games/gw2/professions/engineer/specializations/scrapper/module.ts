import { scrapperTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { bindScrapperUi } from '#gw2/professions/engineer/specializations/scrapper/presentation.js';
import { SCRAPPER_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/scrapper/skills/index.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';

export const scrapperModule = defineNativeModule({
  id: 'Scrapper',
  traitDefinitions: scrapperTraits,
  data: createEngineerModuleData('Scrapper', {
    skillMechanics: SCRAPPER_SKILL_MECHANICS
  }),
  // Scrapper traits share the live state with their actual combo and boon reactions.
  state: { create: scrapperState.create },

  presentation: bindScrapperUi
});
