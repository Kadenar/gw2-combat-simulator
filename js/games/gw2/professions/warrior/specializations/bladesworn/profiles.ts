import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const BLADESWORN_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'warrior.bladesworn.flow',
  burstMastery: 'warrior.bladesworn.burst-mastery',
  dragonTrigger: 'warrior.bladesworn.dragon-trigger',
  artillerySlash: 'warrior.bladesworn.artillery-slash',
  sharpArtillerySlash: 'warrior.bladesworn.sharp-artillery-slash',
  overchargedCartridges: 'warrior.bladesworn.overcharged-cartridges'
});

export const BLADESWORN_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  // Sharp as the Wind uses one strike value and a Bleeding alternative selected by ammunition spent.
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.sharpArtillerySlash,
    name: 'Artillery Slash — Sharp as the Wind',
    profileKind: 'skill-variant',
    parentId: ID.SHARP_ARTILLERY_SLASH,
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 2 },
      {
        name: 'One round',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        packetLabel: 'one round spent'
      },
      {
        name: 'Two rounds',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 7,
        packetLabel: 'two rounds spent'
      },
      // The charge-dependent control packet can be removed independently of strike and Bleeding.
      { name: 'Control', type: 'control' }
    ]
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.resources,
    name: 'Bladesworn Flow',
    profileKind: 'mechanic',
    maximumStacks: 100,
    energyRegenerationPerSecond: 2,
    resourceGain: 4,
    attributePerStack: 2,
    effects: []
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.dragonTrigger,
    name: 'Dragon Trigger Charges',
    profileKind: 'mechanic',
    maximumStacks: 10,
    minimumStacks: 5,
    threshold: 15,
    resourceCost: 5,
    cooldown: 30,
    effects: []
  },

  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.artillerySlash,
    name: 'Artillery Slash - Ammo Variants',
    profileKind: 'skill-variant',
    parentId: ID.ARTILLERY_SLASH,
    effects: [
      { name: 'One round', type: 'strike', coefficient: 2, hits: 1 },
      { name: 'Two rounds', type: 'strike', coefficient: 3, hits: 1 },
      { name: 'Control', type: 'control' }
    ]
  },
  {
    id: BLADESWORN_BALANCE_PROFILE_IDS.overchargedCartridges,
    name: 'Overcharged Cartridges',
    profileKind: 'skill-variant',
    parentId: ID.OVERCHARGED_CARTRIDGES,
    effects: [
      {
        name: 'overcharged-cartridges',
        type: 'buff',
        kind: 'overcharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.15
      },
      { name: 'Overcharged Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
      {
        name: 'supercharged-cartridges',
        type: 'buff',
        kind: 'supercharged-cartridges',
        stacks: 1,
        duration: 8,
        damageIncreasePerStack: 0.2
      },
      { name: 'Supercharged Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 5 }
    ]
  }

  // Trait tuning is shared by build calculations, combat, and tooltips.
]);
