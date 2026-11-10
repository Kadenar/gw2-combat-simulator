import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';
import { THIEF_CORE_PROFILE_FIELDS, THIEF_CORE_SKILL_FIELDS } from '#gw2/professions/thief/core/catalog-fields.js';
import { thiefCoreHooks } from '#gw2/professions/thief/core/hooks.js';
import { thiefCoreUi } from '#gw2/professions/thief/core/presentation.js';
import { thiefPassiveAttributes } from '#gw2/professions/thief/core/skills/attribute-passives.js';
import { THIEF_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/thief/core/skills/autoattack-chains.js';
import { THIEF_CORE_SKILLS } from '#gw2/professions/thief/core/skills/index.js';
import { THIEF_CORE_SKILL_FLIPS } from '#gw2/professions/thief/core/skills/skill-flips.js';
import { createThiefCoreState, projectThiefCorePlanningState } from '#gw2/professions/thief/core/state.js';
import { coreTraits } from '#gw2/professions/thief/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh+oh',
  Pistol: 'mh+oh',
  Rifle: '2h',
  Scepter: 'mh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh'
});

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const thiefCoreModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: THIEF_CORE_SKILL_FLIPS,
    autoattackChains: THIEF_CORE_AUTOATTACK_CHAINS,
    profileFields: THIEF_CORE_PROFILE_FIELDS,
    skillFields: THIEF_CORE_SKILL_FIELDS,
    skills: THIEF_CORE_SKILLS
  }),
  state: { create: createThiefCoreState, project: projectThiefCorePlanningState },
  traitDefinitions: coreTraits,
  attributes: thiefPassiveAttributes,

  hooks: thiefCoreHooks,
  presentation: thiefCoreUi
});
