import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { scourgeHooks } from '#gw2/professions/necromancer/specializations/scourge/hooks.js';

import { bindScourgeUi } from '#gw2/professions/necromancer/specializations/scourge/presentation.js';
import { SCOURGE_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/scourge/skills/index.js';
import {
  SCOURGE_PUBLIC_STATE_PROJECTION,
  scourgeState
} from '#gw2/professions/necromancer/specializations/scourge/state.js';
import { necromancerScourgeTraits } from '#gw2/professions/necromancer/specializations/scourge/traits/index.js';
import { SCOURGE_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/scourge/skill-fields.js';

export const scourgeModule = defineNativeModule({
  traitDefinitions: necromancerScourgeTraits,
  id: 'Scourge',
  data: createNecromancerModuleData('Scourge', {
    skillFields: SCOURGE_SKILL_FIELDS,
    skillMechanics: SCOURGE_BASE_SKILL_MECHANICS
  }),
  state: { create: scourgeState.create, project: createPublicStateProjector(SCOURGE_PUBLIC_STATE_PROJECTION) },
  hooks: scourgeHooks,

  presentation: bindScourgeUi
});
