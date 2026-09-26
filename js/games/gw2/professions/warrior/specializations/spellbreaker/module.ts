import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { SPELLBREAKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/spellbreaker/skills/index.js';
import { spellbreakerModifiers } from '#gw2/professions/warrior/specializations/spellbreaker/modifiers.js';
import { spellbreakerHooks } from '#gw2/professions/warrior/specializations/spellbreaker/hooks.js';
import { spellbreakerState } from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { spellbreakerUi } from '#gw2/professions/warrior/specializations/spellbreaker/presentation.js';
import { SPELLBREAKER_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';

export const spellbreakerModule = defineNativeModule({
  id: 'Spellbreaker',
  data: createWarriorModuleData('Spellbreaker', {
    skillMechanics: SPELLBREAKER_SKILL_MECHANICS,
    balanceProfiles: SPELLBREAKER_BALANCE_PROFILES
  }),
  state: {
    create: spellbreakerState.create
  },
  modifiers: spellbreakerModifiers,
  hooks: spellbreakerHooks,
  presentation: spellbreakerUi
});
