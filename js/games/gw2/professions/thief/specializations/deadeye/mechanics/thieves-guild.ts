import type { ThiefGuildSummonProfile } from '#gw2/professions/thief/types.js';

/** The selected elite owns actor identity and stream startup; attack packets live on canonical actor skills. */
export const DEADEYE_THIEVES_GUILD_PROFILE: ThiefGuildSummonProfile = Object.freeze({
  id: 'thief.deadeye.thieves-guild',
  profileKind: 'mechanic',
  effects: [],
  name: 'Rifle Deadeye',
  displayName: 'Deadeye',
  variant: 'Deadeye',
  weapon: 'Rifle',
  weaponStrengthProfileId: 'weapon.rifle',
  attacks: [
    {
      skillId: 'thief.guild.deadeye.basic',
      initialDelay: 1
    }
  ]
});
