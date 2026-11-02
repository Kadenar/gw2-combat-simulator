import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { composeSkillDefinitions, materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
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
import { ELEMENTALIST_EVOKER_SKILL_FLIPS } from '#gw2/professions/elementalist/specializations/evoker/skills/skill-flips.js';
import { evokerState, projectEvokerPlanningState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { evokerTraits } from '#gw2/professions/elementalist/specializations/evoker/traits/index.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * The Evoker elite specialization module: catalog contributions (skill
 * mechanics and traits), live state factory, execution
 * mechanics, and the build-editor UI contract.
 */
export const evokerModule = defineNativeModule({
  id: 'Evoker',
  traitDefinitions: evokerTraits,
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Evoker',
    traitLines: TRAIT_LINES,
    skillFlips: ELEMENTALIST_EVOKER_SKILL_FLIPS,
    profileFields: ELEMENTALIST_EVOKER_PROFILE_FIELDS,
    skillFields: EVOKER_SKILL_FIELDS,
    // Both owner families contribute complete declarations without allowing duplicate identities to overwrite.
    skills: materializeSkillDefinitions(
      composeSkillDefinitions(EVOKER_FAMILIAR_SKILL_MECHANICS, EVOKER_MEDITATION_SKILL_MECHANICS)
    )
  }),
  state: { create: evokerState.create, project: projectEvokerPlanningState },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: zapModifiers,
  hooks: evokerHooks,
  presentation: evokerUi
});
