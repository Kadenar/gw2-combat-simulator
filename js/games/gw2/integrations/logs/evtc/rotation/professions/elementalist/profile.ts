import type { EvtcProfessionProfileSource } from '../../profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../../../../content/professions/elementalist/data/ids.js';

export const elementalistProfileSource: EvtcProfessionProfileSource = {
  professionId: 'elementalist',
  // Hurl emits one direct packet per rock; the profession reconstructor collapses them into one input.
  ignoredInstantSkillIds: [ID.HURL],
  buffTransitions: [
    // These instant inputs are recorded as their resulting self-buffs under raw IDs
    // that differ from the simulator skills, so replay the buff gains as casts.
    {
      buffSkillId: 73071,
      gain: { name: 'Energize', skillId: ID.ENERGIZE },
      suppressWeaponSwap: false
    },
    {
      buffSkillId: 76507,
      gain: { name: 'Arcane Echo', skillId: ID.ARCANE_ECHO },
      suppressWeaponSwap: false
    },
    {
      buffSkillId: 5585,
      gain: { name: 'Fire Attunement', skillId: ID.FIRE_ATTUNEMENT },
      suppressWeaponSwap: true
    },
    {
      buffSkillId: 5586,
      gain: { name: 'Water Attunement', skillId: ID.WATER_ATTUNEMENT },
      suppressWeaponSwap: true
    },
    {
      buffSkillId: 5575,
      gain: { name: 'Air Attunement', skillId: ID.AIR_ATTUNEMENT },
      suppressWeaponSwap: true
    },
    {
      buffSkillId: 5580,
      gain: { name: 'Earth Attunement', skillId: ID.EARTH_ATTUNEMENT },
      suppressWeaponSwap: true
    }
  ]
};
