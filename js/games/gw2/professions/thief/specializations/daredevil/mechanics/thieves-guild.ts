import type { ThiefGuildSummonProfile } from '#gw2/professions/thief/types.js';

/** The selected elite owns actor identity and stream startup; attack packets live on canonical actor skills. */
export const DAREDEVIL_THIEVES_GUILD_PROFILE: ThiefGuildSummonProfile = Object.freeze({
  id: 'thief.daredevil.thieves-guild',
  profileKind: 'mechanic',
  effects: [],
  name: 'Staff Daredevil',
  displayName: 'Daredevil',
  variant: 'Daredevil',
  weapon: 'Staff',
  weaponStrengthProfileId: 'weapon.staff',
  attacks: [
    {
      skillId: 41056,
      initialDelay: 1.72
    },
    {
      skillId: 40482,
      initialDelay: 2.72
    },
    {
      skillId: 40005,
      initialDelay: 4.04
    }
  ]
});
