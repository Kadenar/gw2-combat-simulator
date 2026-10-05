import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { renegadeHooks } from '#gw2/professions/revenant/specializations/renegade/hooks.js';
import { renegadeUi } from '#gw2/professions/revenant/specializations/renegade/presentation.js';
import { RENEGADE_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { RENEGADE_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/renegade/skills/index.js';
import { RENEGADE_EXTRA_SKILLS } from '#gw2/professions/revenant/specializations/renegade/skills/warband-skills.js';
import {
  RENEGADE_PUBLIC_STATE_PROJECTION,
  renegadeState
} from '#gw2/professions/revenant/specializations/renegade/state.js';
import { modifyRenegadeCriticalChance } from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/renegade/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const renegadeModule = defineNativeModule({
  traitDefinitions,
  id: 'Renegade',
  data: createRevenantModuleData('Renegade', {
    skillMechanics: RENEGADE_BASE_SKILL_MECHANICS,
    extraSkills: RENEGADE_EXTRA_SKILLS,
    balanceProfiles: RENEGADE_BALANCE_PROFILES
  }),
  state: { create: renegadeState.create, project: createPublicStateProjector(RENEGADE_PUBLIC_STATE_PROJECTION) },
  // Compose the trait callback directly; this owner has no additional modifier rules.
  modifiers: { modifyCriticalChance: modifyRenegadeCriticalChance },
  hooks: renegadeHooks,
  presentation: renegadeUi
});
