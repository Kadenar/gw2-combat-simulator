import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import {
  VINDICATOR_PUBLIC_STATE_PROJECTION,
  vindicatorState
} from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { modifyVindicatorAttributes } from '#gw2/professions/revenant/specializations/vindicator/traits/behavior.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/vindicator/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const vindicatorModule = defineNativeModule({
  traitDefinitions,
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    extraSkills: [VINDICATOR_JUMP_SKILL]
  }),
  state: { create: vindicatorState.create, project: createPublicStateProjector(VINDICATOR_PUBLIC_STATE_PROJECTION) },
  // Compose the trait callback directly; this owner has no additional modifier rules.
  modifiers: { modifyAttributes: modifyVindicatorAttributes },
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
