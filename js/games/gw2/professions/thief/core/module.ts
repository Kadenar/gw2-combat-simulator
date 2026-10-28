import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { THIEF_CORE_PROFILE_FIELDS, THIEF_CORE_SKILL_FIELDS } from '#gw2/professions/thief/core/catalog-fields.js';
import { thiefCoreHooks } from '#gw2/professions/thief/core/hooks.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { thiefPassiveAttributes } from '#gw2/professions/thief/core/skills/attribute-passives.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { distractingThrowModifiers } from '#gw2/professions/thief/core/skills/weapons/spear.js';
import { createThiefCoreState, projectThiefCorePlanningState } from '#gw2/professions/thief/core/state.js';
import { coreTraits } from '#gw2/professions/thief/core/traits/index.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const thiefCoreModule = defineNativeModule({
  attributes: thiefPassiveAttributes,
  traitDefinitions: coreTraits,
  id: 'Core',
  data: createThiefModuleData('Core', {
    profileFields: THIEF_CORE_PROFILE_FIELDS,
    skillFields: THIEF_CORE_SKILL_FIELDS,
    skillMechanics: THIEF_CORE_SKILL_MECHANICS,
    extraSkills: THIEF_CORE_EXTRA_SKILLS
  }),
  state: { create: createThiefCoreState, project: projectThiefCorePlanningState },

  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: distractingThrowModifiers,
  hooks: thiefCoreHooks,
  presentation: thiefCoreUi
});
