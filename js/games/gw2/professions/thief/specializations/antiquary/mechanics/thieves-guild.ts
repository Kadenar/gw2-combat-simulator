import type { ThiefGuildSummonProfile } from '#gw2/professions/thief/types.js';

// Antiquary owns the Skritt third summon selected by Thieves Guild.
export const ANTIQUARY_THIEVES_GUILD_PROFILE: ThiefGuildSummonProfile = Object.freeze({
  id: 'thief.antiquary.thieves-guild',
  profileKind: 'mechanic',
  effects: [],
  name: 'Sword/Dagger Skritt',
  displayName: 'Skritt',
  variant: 'Skritt',
  weapon: 'Sword',
  weaponStrengthProfileId: 'weapon.sword',
  // Authored basic attack preserves this summon while allowing an explicit empty list.
  attacks: [{ name: 'Basic Attack', coefficientPerHit: 1.2, hits: 1, initialDelay: 1, interval: 1 }]
});
