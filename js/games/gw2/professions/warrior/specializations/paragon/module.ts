import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { paragonHooks } from '#gw2/professions/warrior/specializations/paragon/hooks.js';
import { paragonUi } from '#gw2/professions/warrior/specializations/paragon/presentation.js';
import { PARAGON_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/paragon/profiles.js';
import { PARAGON_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonState, projectParagonPlanningState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { warriorParagonTraits } from '#gw2/professions/warrior/specializations/paragon/traits/index.js';

export const paragonModule = defineNativeModule({
  traitDefinitions: warriorParagonTraits,
  id: 'Paragon',
  data: createWarriorModuleData('Paragon', {
    skillMechanics: PARAGON_SKILL_MECHANICS,
    balanceProfiles: PARAGON_BALANCE_PROFILES
  }),
  state: { create: paragonState.create, project: projectParagonPlanningState },
  modifiers: {},
  hooks: paragonHooks,
  presentation: paragonUi
});
