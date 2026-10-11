import { SPELLBREAKER_TRAIT_SKILLS } from '#gw2/professions/warrior/specializations/spellbreaker/skills/trait-skills.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { spellbreakerHooks } from '#gw2/professions/warrior/specializations/spellbreaker/hooks.js';
import { spellbreakerUi } from '#gw2/professions/warrior/specializations/spellbreaker/presentation.js';
import { SPELLBREAKER_BALANCE_PROFILES } from '#gw2/professions/warrior/specializations/spellbreaker/profiles.js';
import { SPELLBREAKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/spellbreaker/skills/index.js';
import {
  projectSpellbreakerPlanningState,
  spellbreakerState
} from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { warriorSpellbreakerTraits } from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';

export const spellbreakerModule = defineNativeModule({
  traitDefinitions: warriorSpellbreakerTraits,
  id: 'Spellbreaker',
  data: createWarriorModuleData('Spellbreaker', {
    skillMechanics: SPELLBREAKER_SKILL_MECHANICS,
    extraSkills: SPELLBREAKER_TRAIT_SKILLS,
    balanceProfiles: SPELLBREAKER_BALANCE_PROFILES
  }),
  state: {
    create: spellbreakerState.create,
    project: projectSpellbreakerPlanningState
  },
  hooks: spellbreakerHooks,
  presentation: spellbreakerUi
});
