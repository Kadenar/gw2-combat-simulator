import type { BalanceProfile } from '#gw2/platform/engine/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_CORE_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.core.resources',
  burstTiers: 'warrior.core.burst-tiers',
  eviscerateTier1: 'warrior.core.eviscerate.tier-1',
  eviscerateTier2: 'warrior.core.eviscerate.tier-2',
  eviscerateTier3: 'warrior.core.eviscerate.tier-3',
  bloodthirsterTiers: 'warrior.core.bloodthirster-tiers',
  combustiveShot: 'warrior.core.combustive-shot',
  dragonsRoar: 'warrior.core.dragons-roar',

  signetPassives: 'warrior.core.signet-passives',
  signetOfFuryActive: 'warrior.core.signet-of-fury-active'
});

export const WARRIOR_CORE_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Critical Might is independently patchable and removable without changing Keen Strike's attack.
  {
    id: ID.KEEN_STRIKE,
    name: 'Keen Strike — Critical Might',
    profileKind: 'skill-variant',
    parentId: ID.KEEN_STRIKE,
    effects: [{ name: 'Might', type: 'boon', boon: 'might', stacks: 1, duration: 5 }]
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.resources,
    name: 'Warrior Core Resources',
    profileKind: 'mechanic',
    maximumStacks: 30,
    resourceCost: 50,
    enduranceRegenerationPerSecond: 5,
    vigorRegenerationMultiplier: 1.5,
    effects: []
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.burstTiers,
    name: 'Warrior Burst Tiers',
    profileKind: 'mechanic',
    threshold: 20,
    maximumStacks: 30,
    effects: []
  },
  ...([2, 2.5, 3] as const).map((coefficient, index) => ({
    id: [
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier1,
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier2,
      WARRIOR_CORE_BALANCE_PROFILE_IDS.eviscerateTier3
    ][index],
    name: `Eviscerate - Level ${index + 1}`,
    profileKind: 'skill-variant' as const,
    parentId: ID.EVISCERATE,
    effects: [{ name: 'Strike', type: 'strike' as const, coefficient, hits: 1 }]
  })),
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.bloodthirsterTiers,
    name: 'Bloodthirster Burst Tiers',
    profileKind: 'skill-variant',
    parentId: ID.BLOODTHIRSTER,
    effects: [
      { name: 'Tier 1', type: 'condition', condition: 'Bleeding', stacks: 3, duration: 6 },
      { name: 'Tier 2', type: 'condition', condition: 'Bleeding', stacks: 6, duration: 6 },
      { name: 'Tier 3', type: 'condition', condition: 'Bleeding', stacks: 9, duration: 6 }
    ]
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.combustiveShot,
    name: 'Combustive Shot Burst Tiers',
    profileKind: 'skill-variant',
    parentId: ID.COMBUSTIVE_SHOT,
    pulseInterval: 3,
    durationPerTier: 3,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.5, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }
    ]
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.dragonsRoar,
    name: "Dragon's Roar - Ammo Packet",
    profileKind: 'skill-variant',
    parentId: ID.DRAGONS_ROAR,
    firstPacketRatio: 6 / 7,
    packetIntervalRatio: 2 / 7,
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.75, hits: 1 }]
  },

  // Trait tuning is shared by build calculations, combat, and tooltips.

  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.signetPassives,
    name: 'Warrior Signet Passives',
    profileKind: 'mechanic',
    attributeBonus: 180,
    effects: []
  },
  {
    id: WARRIOR_CORE_BALANCE_PROFILE_IDS.signetOfFuryActive,
    name: 'Signet of Fury - Active',
    profileKind: 'skill-variant',
    parentId: ID.SIGNET_OF_FURY,
    attributeBonus: 360,
    effects: []
  }
]);
