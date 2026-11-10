import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { MESMER_CORE_PROFILE_FIELDS, MESMER_CORE_SKILL_FIELDS } from '#gw2/professions/mesmer/core/catalog-fields.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { mesmerCoreModifiers } from '#gw2/professions/mesmer/core/modifiers.js';
import { mesmerCoreUi } from '#gw2/professions/mesmer/core/presentation.js';
import { mesmerPassiveAttributes } from '#gw2/professions/mesmer/core/skills/attribute-passives.js';
import { MESMER_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/mesmer/core/skills/autoattack-chains.js';
import { MESMER_CORE_SKILLS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_SKILL_FLIPS } from '#gw2/professions/mesmer/core/skills/skill-flips.js';
import { createMesmerCoreState, projectMesmerCorePlanningState } from '#gw2/professions/mesmer/core/state.js';
import { mesmerCoreTraits } from '#gw2/professions/mesmer/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/mesmer/data/trait-lines.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Dagger: 'mh',
  Focus: 'oh',
  Greatsword: '2h',
  Pistol: 'oh',
  Rifle: '2h',
  Scepter: 'mh',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh'
});

export const mesmerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<MesmerSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: MESMER_CORE_SKILL_FLIPS,
    autoattackChains: MESMER_CORE_AUTOATTACK_CHAINS,
    profileFields: MESMER_CORE_PROFILE_FIELDS,
    skillFields: MESMER_CORE_SKILL_FIELDS,
    skills: MESMER_CORE_SKILLS
  }),
  state: {
    create: createMesmerCoreState,
    project: projectMesmerCorePlanningState
  },
  traitDefinitions: mesmerCoreTraits,
  attributes: mesmerPassiveAttributes,
  modifiers: mesmerCoreModifiers,
  hooks: mesmerCoreHooks,
  presentation: mesmerCoreUi
});
