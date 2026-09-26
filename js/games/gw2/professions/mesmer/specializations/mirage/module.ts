import { mirageHooks } from '#gw2/professions/mesmer/specializations/mirage/hooks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { mirageAttributeRules } from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush-rules.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { mirageUi } from '#gw2/professions/mesmer/specializations/mirage/presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { MIRAGE_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/mirage/profiles.js';

export const mirageModule = defineNativeModule({
  id: 'Mirage',
  data: createMesmerModuleData('Mirage', {
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS,
    balanceProfiles: MIRAGE_BALANCE_PROFILES
  }),
  state: {
    create: mirageState.create
  },
  modifiers: mirageAttributeRules,
  hooks: mirageHooks,
  presentation: mirageUi
});
