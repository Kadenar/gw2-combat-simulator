import type { BalanceProfile } from '#gw2/platform/skills/types.js';

// Stable profile IDs let runtime mechanics request patchable values without
// duplicating balance constants in the cast, resolver, and modifier layers.
export const AMALGAM_BALANCE_PROFILE_IDS = Object.freeze({
  morphs: 'engineer.amalgam.morphs',
  strains: 'engineer.amalgam.strains',
  evolve: 'engineer.amalgam.evolve',
  rapaciousStrain: 'engineer.amalgam.rapacious-strain',
  plasmaticState: 'engineer.amalgam.plasmatic-state'
});

// Supply the catalog metadata shared by every trait profile; each entry below
// only needs to declare the values and effects its mechanic consumes.

// Mechanic profiles collect protocol durations, strain scaling, and Evolve
// tuning that would otherwise be spread across scheduler and modifier code.
export const AMALGAM_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: AMALGAM_BALANCE_PROFILE_IDS.rapaciousStrain,
    name: 'Rapacious Strain',
    profileKind: 'mechanic',
    durationMultiplier: 8,
    internalCooldown: 0.48,
    effects: [{ name: 'Rapacious Strain', type: 'strike', coefficient: 0.3, hits: 1 }]
  },
  {
    id: AMALGAM_BALANCE_PROFILE_IDS.morphs,
    name: 'Amalgam Morphs',
    profileKind: 'mechanic',
    pulseInterval: 1,
    maximumStacks: 6,
    effects: [{ name: 'Amalgam Morphs', type: 'strike', coefficient: 0.5, hits: 1 }]
  },
  {
    id: AMALGAM_BALANCE_PROFILE_IDS.strains,
    name: 'Amalgam Strains',
    profileKind: 'mechanic',
    attributePerStack: 5,
    // Protocol identity selects the same immediate packets for combat and tooltip presentation.
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 8,
        sourceId: 'engineer.resiliant-strain',
        name: 'Resiliant Strain',
        metadata: { trigger: 'protect' }
      },
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 8,
        sourceId: 'engineer.replicating-strain',
        name: 'Replicating Strain',
        metadata: { trigger: 'cleanse' }
      },
      {
        type: 'control',
        controlKind: 'stun',
        sourceId: 'engineer.volatile-strain',
        name: 'Volatile Strain',
        metadata: { trigger: 'pierce' }
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 10,
        sourceId: 'engineer.titanic-strain',
        name: 'Titanic Strain',
        metadata: { trigger: 'obliterate' }
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 8,
        sourceId: 'engineer.predator-strain',
        name: 'Predator Strain',
        metadata: { trigger: 'shred' }
      },
      {
        type: 'buff',
        kind: 'superspeed',
        duration: 8,
        sourceId: 'engineer.predator-strain',
        name: 'Predator Strain',
        metadata: { trigger: 'shred' }
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 8,
        stacks: 5,
        sourceId: 'engineer.berserker-strain',
        name: 'Berserker Strain',
        metadata: { trigger: 'demolish' }
      }
    ]
  },
  {
    id: AMALGAM_BALANCE_PROFILE_IDS.evolve,
    name: 'Evolved',
    profileKind: 'mechanic',
    durationMultiplier: 8,
    damageMultiplier: 1.1,
    coefficientMultiplier: 1.2,
    maximumStacks: 2,
    effects: []
  },
  {
    id: AMALGAM_BALANCE_PROFILE_IDS.plasmaticState,
    name: 'Plasmatic State',
    profileKind: 'mechanic',
    durationMultiplier: 6,
    effects: []
  }
]);
