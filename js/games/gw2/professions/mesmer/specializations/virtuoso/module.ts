import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { virtuosoPhantasmalFuryRule } from '#gw2/professions/mesmer/core/traits/dueling/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { virtuosoHooks } from '#gw2/professions/mesmer/specializations/virtuoso/hooks.js';
import { virtuosoUi } from '#gw2/professions/mesmer/specializations/virtuoso/presentation.js';
import { VIRTUOSO_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/virtuoso/profiles.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { projectVirtuosoPlanningState, virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoTraits } from '#gw2/professions/mesmer/specializations/virtuoso/traits/index.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    // Select this specialization's weapon replacements for runtime name lookup.
    skillNameOverrides: {
      Bladecall: ID.BLADECALL
    },
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES
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
