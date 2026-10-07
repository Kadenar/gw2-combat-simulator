import { createDodgeSkill, createWeaponSwapSkill } from '#gw2/platform/skills/shared-actions.js';

/**
 * Owns synthetic Core Engineer actions that do not come from the GW2 skill catalog.
 * Runtime behavior remains in the named skill or mechanic handler owners.
 */

import { ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS } from '#gw2/professions/engineer/core/skills/kits/elite-mortar-kit.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

const extraSkills: EngineerSkill[] = [
  ...ENGINEER_ELITE_MORTAR_KIT_EXTRA_SKILLS,
  createDodgeSkill({
    cost: { resource: 'endurance', profileAmount: { profileId: PROFILE.resources, field: 'resourceCost' } }
  }),
  createWeaponSwapSkill()
];

/** Supplies the frozen synthetic-action catalog to Core module composition. */
export const ENGINEER_CORE_EXTRA_SKILLS = Object.freeze(extraSkills.map((skill) => Object.freeze(skill)));
