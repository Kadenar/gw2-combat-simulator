import type { BalanceProfile } from '#gw2/platform/skills/types.js';

/** Shared form, spear-stack, and summon-attribute policy has no single ordinary skill owner. */
export const NECROMANCER_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  soulShards: 'necromancer.core.soul-shards',
  shroud: 'necromancer.core.death-shroud',
  summonAttributes: 'necromancer.core.summon-attributes'
});

export const NECROMANCER_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.soulShards,
    name: 'Soul Shards - Detonation',
    profileKind: 'mechanic',
    maximumStacks: 6,
    threshold: 0.5,
    damageMultiplier: 1.5,
    effects: []
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.shroud,
    name: 'Death Shroud',
    profileKind: 'mechanic',
    lifeForceDrain: 3,
    effects: []
  },
  {
    id: NECROMANCER_CORE_BALANCE_PROFILE_IDS.summonAttributes,
    name: 'Necromancer Summon Attributes',
    profileKind: 'mechanic',
    weaponStrength: 1048,
    effects: []
  }
]);
