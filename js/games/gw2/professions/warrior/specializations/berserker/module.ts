import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { berserkerAttributes } from '#gw2/professions/warrior/specializations/berserker/attributes.js';
import { berserkerHooks } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { berserkerUi } from '#gw2/professions/warrior/specializations/berserker/presentation.js';
import {
  BERSERKER_SKILL_MECHANICS,
  slicingMaelstromModifiers
} from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  berserkerState,
  projectBerserkerPlanningState
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import { warriorBerserkerTraits } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';
import { BERSERKER_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/berserker/catalog-fields.js';

export const berserkerModule = defineNativeModule({
  traitDefinitions: warriorBerserkerTraits,
  id: 'Berserker',
  data: createWarriorModuleData('Berserker', {
    skillFields: BERSERKER_SKILL_FIELDS,
    skillMechanics: BERSERKER_SKILL_MECHANICS
  }),
  state: { create: berserkerState.create, project: projectBerserkerPlanningState },
  // Preserve live trait attributes alongside skill-owned Slicing Maelstrom rules.
  attributes: berserkerAttributes,
  modifiers: { modifierRules: slicingMaelstromModifiers },
  hooks: berserkerHooks,
  presentation: berserkerUi
});
