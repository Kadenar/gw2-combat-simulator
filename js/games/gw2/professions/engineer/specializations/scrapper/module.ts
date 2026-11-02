import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/engineer/data/trait-lines.js';
import { ENGINEER_SCRAPPER_PROFILE_FIELDS } from '#gw2/professions/engineer/specializations/scrapper/catalog-fields.js';
import { bindScrapperUi } from '#gw2/professions/engineer/specializations/scrapper/presentation.js';
import { SCRAPPER_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/scrapper/skills/index.js';
import { scrapperState } from '#gw2/professions/engineer/specializations/scrapper/state.js';
import { scrapperTraits } from '#gw2/professions/engineer/specializations/scrapper/traits/index.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

export const scrapperModule = defineNativeModule({
  id: 'Scrapper',
  traitDefinitions: scrapperTraits,
  data: createNativeModuleData<EngineerSkill>({
    id: 'Scrapper',
    traitLines: TRAIT_LINES,
    profileFields: ENGINEER_SCRAPPER_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(SCRAPPER_SKILL_MECHANICS)
  }),
  // Scrapper traits share the live state with their actual combo and boon reactions.
  state: { create: scrapperState.create },

  presentation: bindScrapperUi
});
