import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import {
  NECROMANCER_SCOURGE_PROFILE_FIELDS,
  SCOURGE_SKILL_FIELDS
} from '#gw2/professions/necromancer/specializations/scourge/catalog-fields.js';
import { scourgeHooks } from '#gw2/professions/necromancer/specializations/scourge/hooks.js';
import { bindScourgeUi } from '#gw2/professions/necromancer/specializations/scourge/presentation.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/scourge/skills/index.js';
import {
  projectScourgePlanningState,
  scourgeState
} from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { necromancerScourgeTraits } from '#gw2/professions/necromancer/specializations/scourge/traits/index.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export const scourgeModule = defineNativeModule({
  traitDefinitions: necromancerScourgeTraits,
  id: 'Scourge',
  data: createNativeModuleData<NecromancerSkill>({
    id: 'Scourge',
    traitLines: TRAIT_LINES,
    profileFields: NECROMANCER_SCOURGE_PROFILE_FIELDS,
    skillFields: SCOURGE_SKILL_FIELDS,
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS
  }),
  state: { create: scourgeState.create, project: projectScourgePlanningState },
  hooks: scourgeHooks,

  presentation: bindScourgeUi
});
