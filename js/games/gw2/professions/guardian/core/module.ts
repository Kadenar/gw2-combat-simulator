import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  GUARDIAN_CORE_PROFILE_FIELDS,
  GUARDIAN_CORE_SKILL_FIELDS
} from '#gw2/professions/guardian/core/catalog-fields.js';
import { guardianCoreHooks } from '#gw2/professions/guardian/core/hooks.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { guardianPassiveAttributes } from '#gw2/professions/guardian/core/skills/attribute-passives.js';
import { GUARDIAN_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/guardian/core/skills/autoattack-chains.js';
import { GUARDIAN_CORE_SKILLS } from '#gw2/professions/guardian/core/skills/index.js';
import { GUARDIAN_CORE_SKILL_FLIPS } from '#gw2/professions/guardian/core/skills/skill-flips.js';
import { createGuardianCoreState, projectGuardianPlanningState } from '#gw2/professions/guardian/core/state.js';
import { guardianCoreTraits } from '#gw2/professions/guardian/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh',
  Focus: 'oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh',
  Pistol: 'mh+oh',
  Scepter: 'mh',
  Shield: 'oh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh',
  Torch: 'oh'
});

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const guardianCoreModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<GuardianSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: GUARDIAN_CORE_SKILL_FLIPS,
    autoattackChains: GUARDIAN_CORE_AUTOATTACK_CHAINS,
    profileFields: GUARDIAN_CORE_PROFILE_FIELDS,
    skills: GUARDIAN_CORE_SKILLS,

    skillFields: GUARDIAN_CORE_SKILL_FIELDS
  }),
  state: { create: createGuardianCoreState, project: projectGuardianPlanningState },
  traitDefinitions: guardianCoreTraits,
  attributes: guardianPassiveAttributes,
  hooks: guardianCoreHooks,
  presentation: bindGuardianCoreUi
});
