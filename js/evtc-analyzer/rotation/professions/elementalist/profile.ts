import type { ProfessionProfileSource } from '../../profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '../../../../professions/elementalist/data/ids.js';

export const elementalistProfileSource: ProfessionProfileSource = {
  id: 'elementalist',
  name: 'Elementalist',
  specializations: {
    core: 'Core',
    tempest: 'Tempest',
    weaver: 'Weaver',
    catalyst: 'Catalyst',
    evoker: 'Evoker'
  },
  dodgeId: ID.DODGE,
  // Hurl emits one direct packet per rock; the profession reconstructor collapses them into one input.
  ignoredInstantSkillIds: [ID.HURL],
  skillIdAliasesBySpecialization: Object.fromEntries(
    ['core', 'tempest', 'weaver', 'catalyst', 'evoker'].map((specialization) => [
      specialization,
      {
        // ArcDPS records the attunement-specific Glyph of Storms packets.
        5736: ID.GLYPH_OF_STORMS_FIRE,
        5737: ID.GLYPH_OF_STORMS_AIR
      }
    ])
  ),
  buffTransitions: [
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
