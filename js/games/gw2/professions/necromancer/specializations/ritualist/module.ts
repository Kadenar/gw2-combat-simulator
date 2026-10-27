import { RITUALIST_SPIRIT_ATTACK_SKILLS } from '#gw2/professions/necromancer/specializations/ritualist/skills/spirit-attacks.js';
import { RITUALIST_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/ritualist/catalog-fields.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { ritualistHooks } from '#gw2/professions/necromancer/specializations/ritualist/hooks.js';
import { bindRitualistUi } from '#gw2/professions/necromancer/specializations/ritualist/presentation.js';
import {
  RITUALIST_BASE_SKILL_MECHANICS,
  anguishConditionModifier,
  essenceBlastSpiritModifier
} from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { projectRitualistState, ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { necromancerRitualistTraits } from '#gw2/professions/necromancer/specializations/ritualist/traits/index.js';

export const ritualistModule = defineNativeModule({
  traitDefinitions: necromancerRitualistTraits,
  id: 'Ritualist',
  data: createNecromancerModuleData('Ritualist', {
    extraSkills: RITUALIST_SPIRIT_ATTACK_SKILLS,
    skillFields: RITUALIST_SKILL_FIELDS,
    skillMechanics: RITUALIST_BASE_SKILL_MECHANICS
  }),
  // One state factory supplies the live combat owner.
  state: { create: ritualistState.create, project: projectRitualistState },
  hooks: ritualistHooks,
  // Retain the skill rules' established order relative to registered trait modifiers.
  modifiers: [
    { ...essenceBlastSpiritModifier, order: 0 },
    { ...anguishConditionModifier, order: 2 }
  ],
  presentation: bindRitualistUi
});
