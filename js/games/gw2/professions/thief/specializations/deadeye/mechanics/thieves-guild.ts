import type { ThiefSummonDefinition } from '#gw2/professions/thief/types.js';

// Deadeye owns the rifle-wielding third summon selected by Thieves Guild.
export const DEADEYE_THIEVES_GUILD_SUMMON: ThiefSummonDefinition = Object.freeze({
  name: 'Rifle Deadeye',
  displayName: 'Deadeye',
  variant: 'Deadeye',
  weapon: 'Rifle',
  weaponStrengthProfileId: 'weapon.rifle',
  // Authored basic attack preserves this summon while allowing an explicit empty list.
  attacks: [{ name: 'Basic Attack', coefficientPerHit: 1.2, hits: 1, initialDelay: 1, interval: 1 }]
});
