import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { RANGER_CORE_PROFILE_FIELDS, RANGER_CORE_SKILL_FIELDS } from '#gw2/professions/ranger/core/catalog-fields.js';
import { rangerCoreHooks } from '#gw2/professions/ranger/core/hooks.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { rangerPassiveAttributes } from '#gw2/professions/ranger/core/skills/attribute-passives.js';
import { RANGER_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/ranger/core/skills/autoattack-chains.js';
import { RANGER_CORE_SKILLS } from '#gw2/professions/ranger/core/skills/index.js';
import { RANGER_CORE_SKILL_FLIPS } from '#gw2/professions/ranger/core/skills/skill-flips.js';
import { rangerForceOfNatureModifier } from '#gw2/professions/ranger/core/skills/weapons/mace.js';
import { createRangerCoreState, projectRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { rangerCoreTraits } from '#gw2/professions/ranger/core/traits/index.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Axe: 'mh+oh',
  Dagger: 'mh+oh',
  Greatsword: '2h',
  Hammer: '2h',
  Longbow: '2h',
  Mace: 'mh+oh',
  Shortbow: '2h',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh',
  Torch: 'oh',
  Warhorn: 'oh'
});

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<RangerSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: RANGER_CORE_SKILL_FLIPS,
    autoattackChains: RANGER_CORE_AUTOATTACK_CHAINS,
    profileFields: RANGER_CORE_PROFILE_FIELDS,
    skillFields: RANGER_CORE_SKILL_FIELDS,
    skills: RANGER_CORE_SKILLS
  }),
  state: { create: createRangerCoreState, project: projectRangerCoreState },
  traitDefinitions: rangerCoreTraits,
  attributes: rangerPassiveAttributes,
  modifiers: [rangerForceOfNatureModifier],
  hooks: rangerCoreHooks,
  presentation: bindRangerCoreUi
});
