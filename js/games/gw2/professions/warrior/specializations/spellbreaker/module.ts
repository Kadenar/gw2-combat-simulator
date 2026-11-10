import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import { spellbreakerHooks } from '#gw2/professions/warrior/specializations/spellbreaker/hooks.js';
import { spellbreakerUi } from '#gw2/professions/warrior/specializations/spellbreaker/presentation.js';
import { SPELLBREAKER_SKILLS } from '#gw2/professions/warrior/specializations/spellbreaker/skills/index.js';
import {
  projectSpellbreakerPlanningState,
  spellbreakerState
} from '#gw2/professions/warrior/specializations/spellbreaker/state.js';
import { warriorSpellbreakerTraits } from '#gw2/professions/warrior/specializations/spellbreaker/traits/index.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const spellbreakerModule = defineNativeModule({
  id: 'Spellbreaker',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Spellbreaker',
    traitLines: TRAIT_LINES,
    skills: SPELLBREAKER_SKILLS
  }),
  state: {
    create: spellbreakerState.create,
    project: projectSpellbreakerPlanningState
  },
  traitDefinitions: warriorSpellbreakerTraits,
  hooks: spellbreakerHooks,
  presentation: spellbreakerUi
});
