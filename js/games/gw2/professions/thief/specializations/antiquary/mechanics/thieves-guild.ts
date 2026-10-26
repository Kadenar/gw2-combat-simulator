import type { ThiefGuildSummonProfile } from '#gw2/professions/thief/types.js';

/** The selected elite owns actor identity and stream startup; attack packets live on canonical actor skills. */
export const ANTIQUARY_THIEVES_GUILD_PROFILE: ThiefGuildSummonProfile = Object.freeze({
  id: 'thief.antiquary.thieves-guild',
  profileKind: 'mechanic',
  effects: [],
  name: 'Sword/Dagger Skritt',
  displayName: 'Skritt',
  variant: 'Skritt',
  weapon: 'Sword',
  weaponStrengthProfileId: 'weapon.sword',
  attacks: [
    {
      skillId: 'thief.guild.antiquary.basic',
      initialDelay: 1
    }
  ]
});
