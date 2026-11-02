import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { WEAVER_SKILL_FIELDS } from '#gw2/professions/elementalist/specializations/weaver/catalog-fields.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import { weaverUi } from '#gw2/professions/elementalist/specializations/weaver/presentation.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';
import { ELEMENTALIST_WEAVER_SKILL_FLIPS } from '#gw2/professions/elementalist/specializations/weaver/skills/skill-flips.js';
import { weaveSelfModifiers } from '#gw2/professions/elementalist/specializations/weaver/skills/slot-skills.js';
import { projectWeaverPlanningState, weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaverTraits } from '#gw2/professions/elementalist/specializations/weaver/traits/index.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Weaver specialization module.
 *
 * Binds the dual-attunement mechanics, scheduler/resolver state factories, skill
 * catalog definitions and UI contract that the registry layers
 * on top of the shared Elementalist core.
 */
export const weaverModule = defineNativeModule({
  id: 'Weaver',
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Weaver',
    traitLines: TRAIT_LINES,
    skillFlips: ELEMENTALIST_WEAVER_SKILL_FLIPS,
    skillFields: WEAVER_SKILL_FIELDS,
    skills: materializeSkillDefinitions(WEAVER_SKILL_MECHANICS)
  }),
  state: { create: weaverState.create, project: projectWeaverPlanningState },
  traitDefinitions: weaverTraits,
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: weaveSelfModifiers,
  hooks: weaverHooks,
  presentation: weaverUi
});
