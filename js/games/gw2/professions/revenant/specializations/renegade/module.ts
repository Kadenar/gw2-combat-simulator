import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import { REVENANT_RENEGADE_PROFILE_FIELDS } from '#gw2/professions/revenant/specializations/renegade/catalog-fields.js';
import { renegadeHooks } from '#gw2/professions/revenant/specializations/renegade/hooks.js';
import { renegadeUi } from '#gw2/professions/revenant/specializations/renegade/presentation.js';
import { RENEGADE_SKILLS } from '#gw2/professions/revenant/specializations/renegade/skills/index.js';
import { REVENANT_RENEGADE_SKILL_FLIPS } from '#gw2/professions/revenant/specializations/renegade/skills/skill-flips.js';
import {
  projectRenegadePlanningState,
  renegadeState
} from '#gw2/professions/revenant/specializations/renegade/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/renegade/traits/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const renegadeModule = defineNativeModule({
  id: 'Renegade',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Renegade',
    traitLines: TRAIT_LINES,
    skillFlips: REVENANT_RENEGADE_SKILL_FLIPS,
    profileFields: REVENANT_RENEGADE_PROFILE_FIELDS,
    skills: RENEGADE_SKILLS
  }),
  state: { create: renegadeState.create, project: projectRenegadePlanningState },
  traitDefinitions,
  hooks: renegadeHooks,
  presentation: renegadeUi
});
