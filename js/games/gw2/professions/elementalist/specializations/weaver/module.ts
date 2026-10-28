import { weaveSelfModifiers } from '#gw2/professions/elementalist/specializations/weaver/skills/slot-skills.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createElementalistModuleData } from '#gw2/professions/elementalist/data/module-data.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';

import { weaverUi } from '#gw2/professions/elementalist/specializations/weaver/presentation.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';
import { weaverState, projectWeaverPlanningState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaverTraits } from '#gw2/professions/elementalist/specializations/weaver/traits/index.js';
import { WEAVER_SKILL_FIELDS } from '#gw2/professions/elementalist/specializations/weaver/catalog-fields.js';

/**
 * Weaver specialization module.
 *
 * Binds the dual-attunement mechanics, scheduler/resolver state factories, skill
 * catalog fragments and UI contract that the registry layers
 * on top of the shared Elementalist core.
 */
export const weaverModule = defineNativeModule({
  id: 'Weaver',
  data: createElementalistModuleData('Weaver', {
    skillFields: WEAVER_SKILL_FIELDS,
    skillMechanics: WEAVER_SKILL_MECHANICS
  }),
  state: { create: weaverState.create, project: projectWeaverPlanningState },
  traitDefinitions: weaverTraits,
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: weaveSelfModifiers,
  hooks: weaverHooks,
  presentation: weaverUi
});
