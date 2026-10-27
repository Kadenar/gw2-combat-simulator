import { WARRIOR_CORE_PROFILE_FIELDS } from '#gw2/professions/warrior/core/catalog-fields.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { warriorCoreHooks } from '#gw2/professions/warrior/core/hooks.js';
import { warriorBurstSkillModifiers } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { warriorDaggerSkillModifiers } from '#gw2/professions/warrior/core/skills/weapons/dagger.js';
import { warriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { warriorPassiveAttributes } from '#gw2/professions/warrior/core/skills/attribute-passives.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_CORE_TRAIT_SKILLS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS
} from '#gw2/professions/warrior/core/skills/index.js';
import { signetActiveAttributeEffects } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { createWarriorCoreState, WARRIOR_CORE_PUBLIC_STATE_PROJECTION } from '#gw2/professions/warrior/core/state.js';
import { warriorCoreTraits } from '#gw2/professions/warrior/core/traits/index.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import { WARRIOR_CORE_SKILL_FIELDS } from '#gw2/professions/warrior/core/catalog-fields.js';

export const warriorCoreModule = defineNativeModule({
  attributes: (context) => [
    ...warriorPassiveAttributes(context),
    { attributeEffects: signetActiveAttributeEffects(context) }
  ],
  id: 'Core',
  data: createWarriorModuleData('Core', {
    profileFields: WARRIOR_CORE_PROFILE_FIELDS,
    skillFields: WARRIOR_CORE_SKILL_FIELDS,
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS, ...WARRIOR_CORE_TRAIT_SKILLS]
  }),
  state: {
    create: createWarriorCoreState,
    project: createPublicStateProjector(WARRIOR_CORE_PUBLIC_STATE_PROJECTION)
  },
  traitDefinitions: warriorCoreTraits,
  // Keep burst rules before dagger rules when their explicit orders tie.
  modifiers: [...warriorBurstSkillModifiers, ...warriorDaggerSkillModifiers],
  hooks: warriorCoreHooks,
  // Core presentation is catalog-independent and can be registered directly.
  presentation: warriorCoreUi
});
