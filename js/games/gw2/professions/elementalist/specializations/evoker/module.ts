import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import {
  ELEMENTALIST_EVOKER_PROFILE_FIELDS,
  EVOKER_SKILL_FIELDS
} from '#gw2/professions/elementalist/specializations/evoker/catalog-fields.js';
import { evokerHooks } from '#gw2/professions/elementalist/specializations/evoker/hooks.js';
import { evokerUi } from '#gw2/professions/elementalist/specializations/evoker/presentation.js';
import {
  EVOKER_FAMILIAR_SKILL_MECHANICS,
  zapModifiers
} from '#gw2/professions/elementalist/specializations/evoker/skills/familiar-skills.js';
import { EVOKER_MEDITATION_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/evoker/skills/meditation-skills.js';
import { evokerState, projectEvokerPlanningState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { evokerTraits } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics and traits), live state factory, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  traitDefinitions: evokerTraits,
  data: createElementalistModuleData('Evoker', {
    profileFields: ELEMENTALIST_EVOKER_PROFILE_FIELDS,
    skillFields: EVOKER_SKILL_FIELDS,
    // Assemble both skill families at the module boundary in familiar-first order.
    skillMechanics: {
      ...EVOKER_FAMILIAR_SKILL_MECHANICS,
      ...EVOKER_MEDITATION_SKILL_MECHANICS
    }
  }),
  state: { create: evokerState.create, project: projectEvokerPlanningState },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: zapModifiers,
  hooks: evokerHooks,
  presentation: evokerUi
});
