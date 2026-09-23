import type { ThiefSummonDefinition } from '#gw2/professions/thief/types.js';

// Antiquary owns the Skritt third summon selected by Thieves Guild.
export const ANTIQUARY_THIEVES_GUILD_SUMMON: ThiefSummonDefinition = Object.freeze({
  name: 'Sword/Dagger Skritt',
  displayName: 'Skritt',
  variant: 'Skritt',
  weapon: 'Sword',
  weaponStrengthProfileId: 'weapon.sword',
  // Authored basic attack preserves this summon while allowing an explicit empty list.
  attacks: [{ name: 'Basic Attack', coefficientPerHit: 1.2, hits: 1, initialDelay: 1, interval: 1 }]
});
