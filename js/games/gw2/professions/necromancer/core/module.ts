import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  NECROMANCER_CORE_PROFILE_FIELDS,
  NECROMANCER_CORE_SKILL_FIELDS
} from '#gw2/professions/necromancer/core/catalog-fields.js';
import { necromancerCoreHooks } from '#gw2/professions/necromancer/core/hooks.js';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/initial-state.js';
import { bindNecromancerCoreUi } from '#gw2/professions/necromancer/core/presentation.js';
import { necromancerPassiveAttributes } from '#gw2/professions/necromancer/core/skills/attribute-passives.js';
import { NECROMANCER_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/necromancer/core/skills/autoattack-chains.js';
import {
  NECROMANCER_CORE_BASE_SKILL_MECHANICS,
  NECROMANCER_CORE_EXTRA_SKILLS
} from '#gw2/professions/necromancer/core/skills/index.js';
import { NECROMANCER_CORE_SKILL_FLIPS } from '#gw2/professions/necromancer/core/skills/skill-flips.js';
import { ghastlyClawsVulnerabilityModifier } from '#gw2/professions/necromancer/core/skills/weapons/axe.js';
import { lifeSiphonBleedingModifier } from '#gw2/professions/necromancer/core/skills/weapons/dagger.js';
import { projectNecromancerPlanningState } from '#gw2/professions/necromancer/core/state.js';
import { necromancerCoreTraits } from '#gw2/professions/necromancer/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh+oh',
  Focus: 'oh',
  Greatsword: '2h',
  Pistol: 'mh',
  Scepter: 'mh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh',
  Warhorn: 'oh'
});

export const necromancerCoreModule = defineNativeModule({
  attributes: necromancerPassiveAttributes,
  traitDefinitions: necromancerCoreTraits,
  id: 'Core',
  data: createNativeModuleData<NecromancerSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: NECROMANCER_CORE_SKILL_FLIPS,
    profileFields: NECROMANCER_CORE_PROFILE_FIELDS,
    skillFields: NECROMANCER_CORE_SKILL_FIELDS,
    skillMechanics: NECROMANCER_CORE_BASE_SKILL_MECHANICS,
    extraSkills: NECROMANCER_CORE_EXTRA_SKILLS,
    autoattackChains: NECROMANCER_CORE_AUTOATTACK_CHAINS
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
