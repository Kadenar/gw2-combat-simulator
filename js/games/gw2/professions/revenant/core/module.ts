import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import {
  REVENANT_CORE_PROFILE_FIELDS,
  REVENANT_CORE_SKILL_FIELDS
} from '#gw2/professions/revenant/core/catalog-fields.js';
import { revenantCoreHooks } from '#gw2/professions/revenant/core/hooks.js';
import { revenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import { REVENANT_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/revenant/core/skills/autoattack-chains.js';
import { REVENANT_CORE_SKILLS } from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_CORE_SKILL_FLIPS } from '#gw2/professions/revenant/core/skills/skill-flips.js';
import { createRevenantCoreState, projectRevenantPlanningState } from '#gw2/professions/revenant/core/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'oh',
  Greatsword: '2h',
  Hammer: '2h',
  Mace: 'mh',
  Scepter: 'mh',
  Shield: 'oh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh+oh'
});

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const revenantCoreModule = defineNativeModule({
  traitDefinitions,
  id: 'Core',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: REVENANT_CORE_SKILL_FLIPS,
    autoattackChains: REVENANT_CORE_AUTOATTACK_CHAINS,
    profileFields: REVENANT_CORE_PROFILE_FIELDS,
    skillFields: REVENANT_CORE_SKILL_FIELDS,
    skills: REVENANT_CORE_SKILLS
  }),
  state: {
    create: createRevenantCoreState,
    project: projectRevenantPlanningState
  },
  hooks: revenantCoreHooks,
  presentation: revenantCoreUi
});
