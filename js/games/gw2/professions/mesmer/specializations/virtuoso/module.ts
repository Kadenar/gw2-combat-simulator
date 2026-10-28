import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { virtuosoPhantasmalFuryRule } from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { MESMER_VIRTUOSO_PROFILE_FIELDS } from '#gw2/professions/mesmer/specializations/virtuoso/catalog-fields.js';
import { virtuosoHooks } from '#gw2/professions/mesmer/specializations/virtuoso/hooks.js';
import { virtuosoUi } from '#gw2/professions/mesmer/specializations/virtuoso/presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { projectVirtuosoPlanningState, virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoTraits } from '#gw2/professions/mesmer/specializations/virtuoso/traits/index.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    profileFields: MESMER_VIRTUOSO_PROFILE_FIELDS,
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS
  }),
  state: {
    create: virtuosoState.create,
    project: projectVirtuosoPlanningState
  },
  traitDefinitions: virtuosoTraits,
  modifiers: { modifierRules: [virtuosoPhantasmalFuryRule] },
  hooks: virtuosoHooks,
  presentation: virtuosoUi
});
