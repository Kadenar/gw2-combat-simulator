import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { conduitModifiers } from '#gw2/professions/revenant/specializations/conduit/modifiers.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { conduitUi } from '#gw2/professions/revenant/specializations/conduit/presentation.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/index.js';
import { CONDUIT_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitHooks } from '#gw2/professions/revenant/specializations/conduit/hooks.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const conduitModule = defineNativeModule({
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    balanceProfiles: CONDUIT_BALANCE_PROFILES
  }),
  state: { create: conduitState.create },
  modifiers: conduitModifiers,
  hooks: conduitHooks,
  presentation: conduitUi
});
