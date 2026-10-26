import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { necromancerCoreHooks } from '#gw2/professions/necromancer/core/hooks.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/initial-state.js';
import { ghastlyClawsVulnerabilityModifier } from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { lifeSiphonBleedingModifier } from '#gw2/professions/necromancer/core/skills/weapons/dagger.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import { NECROMANCER_CORE_BALANCE_PROFILES } from '#gw2/professions/necromancer/core/profiles.js';
import { necromancerPassiveAttributes } from '#gw2/professions/necromancer/core/skills/attribute-passives.js';
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS
} from '#gw2/professions/necromancer/core/skills/index.js';
import { projectNecromancerPlanningState } from '#gw2/professions/necromancer/core/state.js';
import { necromancerCoreTraits } from '#gw2/professions/necromancer/core/traits/index.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { NECROMANCER_CORE_SKILL_FIELDS } from '#gw2/professions/necromancer/core/skill-fields.js';

export const necromancerCoreModule = defineNativeModule({
  attributes: necromancerPassiveAttributes,
  traitDefinitions: necromancerCoreTraits,
  id: 'Core',
  data: createNecromancerModuleData('Core', {
    skillFields: NECROMANCER_CORE_SKILL_FIELDS,
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    balanceProfiles: NECROMANCER_CORE_BALANCE_PROFILES,
    autoattackChains: {
      // The API does not link Echo to the omitted final step, so declare the complete in-game sequence explicitly.
      additional: [[ID.ENERVATION_BLADE, ID.ENERVATION_ECHO, ID.DEATHLY_ENERVATION]]
    }
  }),
  state: {
    create: createNecromancerCoreState,
    project: projectNecromancerPlanningState
  },
  hooks: necromancerCoreHooks,
  // Skill rules retain their ordering; selected traits own their damage and duration rules.
  modifiers: [
    { ...lifeSiphonBleedingModifier, order: -20 },
    { ...ghastlyClawsVulnerabilityModifier, order: 108 }
  ],
  presentation: bindNecromancerCoreUi
});
