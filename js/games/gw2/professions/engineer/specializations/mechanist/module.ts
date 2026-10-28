import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { mechanistAttributes } from '#gw2/professions/engineer/specializations/mechanist/attributes.js';
import {
  ENGINEER_MECHANIST_PROFILE_FIELDS,
  MECHANIST_SKILL_FIELDS
} from '#gw2/professions/engineer/specializations/mechanist/catalog-fields.js';
import { mechanistHooks } from '#gw2/professions/engineer/specializations/mechanist/hooks.js';
import { mechanistUi } from '#gw2/professions/engineer/specializations/mechanist/presentation.js';
import { MECHANIST_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/mechanist/skills/index.js';
import { signetModifierRules } from '#gw2/professions/engineer/specializations/mechanist/skills/signet-skills.js';
import {
  mechanistState,
  projectMechanistPlanningState
} from '#gw2/professions/engineer/specializations/mechanist/state.js';
import { mechanistTraits } from '#gw2/professions/engineer/specializations/mechanist/traits/index.js';

// Compose the mech's independent live lane with accepted-hit reactions for
// hit-triggered traits; the engineer's own cast lane remains owned by Core.
export const mechanistModule = defineNativeModule({
  id: 'Mechanist',
  traitDefinitions: mechanistTraits,
  data: createEngineerModuleData('Mechanist', {
    profileFields: ENGINEER_MECHANIST_PROFILE_FIELDS,
    skillFields: MECHANIST_SKILL_FIELDS,
    skillMechanics: MECHANIST_SKILL_MECHANICS
  }),
  state: { create: mechanistState.create, project: projectMechanistPlanningState },
  attributes: mechanistAttributes,
  // Signets own their packet rules; actor projection remains in the attribute calculator.
  modifiers: Object.freeze([...signetModifierRules]),
  hooks: mechanistHooks,
  presentation: mechanistUi
});
