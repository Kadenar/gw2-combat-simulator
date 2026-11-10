import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';
import {
  WARRIOR_CORE_PROFILE_FIELDS,
  WARRIOR_CORE_SKILL_FIELDS
} from '#gw2/professions/warrior/core/catalog-fields.js';
import { warriorCoreHooks } from '#gw2/professions/warrior/core/hooks.js';
import { warriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { warriorPassiveAttributes } from '#gw2/professions/warrior/core/skills/attribute-passives.js';
import { WARRIOR_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/warrior/core/skills/autoattack-chains.js';
import { WARRIOR_CORE_SKILLS } from '#gw2/professions/warrior/core/skills/index.js';
import { WARRIOR_CORE_SKILL_FLIPS } from '#gw2/professions/warrior/core/skills/skill-flips.js';
import { signetActiveAttributeEffects } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { createWarriorCoreState, projectWarriorCorePlanningState } from '#gw2/professions/warrior/core/state.js';
import { warriorCoreTraits } from '#gw2/professions/warrior/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh+oh',
  Dagger: 'mh+oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh+oh',
  Pistol: 'oh',
  Rifle: '2h',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh',
  Warhorn: 'oh'
});

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: WARRIOR_CORE_SKILL_FLIPS,
    autoattackChains: WARRIOR_CORE_AUTOATTACK_CHAINS,
    profileFields: WARRIOR_CORE_PROFILE_FIELDS,
    skillFields: WARRIOR_CORE_SKILL_FIELDS,
    skills: WARRIOR_CORE_SKILLS
  }),
  state: {
    create: createWarriorCoreState,
    project: projectWarriorCorePlanningState
  },
  traitDefinitions: warriorCoreTraits,
  attributes: (context) => [
    ...warriorPassiveAttributes(context),
    { attributeEffects: signetActiveAttributeEffects(context) }
  ],
  hooks: warriorCoreHooks,
  // Core presentation is catalog-independent and can be registered directly.
  presentation: warriorCoreUi
});
