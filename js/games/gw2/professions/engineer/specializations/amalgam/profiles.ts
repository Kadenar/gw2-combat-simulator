import { CONTROL, STATUS, BOON } from '#gw2/platform/constants.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';

// Stable profile IDs let runtime mechanics request patchable values without
// duplicating balance constants in the cast, resolver, and modifier layers.
export const AMALGAM_BALANCE_PROFILE_IDS = Object.freeze({
  morphs: 'engineer.amalgam.morphs',
  strains: 'engineer.amalgam.strains',
  rapaciousStrain: 'engineer.amalgam.rapacious-strain'
});

// Supply the catalog metadata shared by every trait profile; each entry below
// only needs to declare the values and effects its mechanic consumes.

// Mechanic profiles collect shared protocol and strain tuning; castable skills own their form durations.
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
        boon: BOON.RESISTANCE,
        duration: 8,
        sourceId: 'engineer.resiliant-strain',
        name: 'Resiliant Strain',
        metadata: { trigger: 'protect' }
      },
      {
        type: 'boon',
        boon: BOON.ALACRITY,
        duration: 8,
        sourceId: 'engineer.replicating-strain',
        name: 'Replicating Strain',
        metadata: { trigger: 'cleanse' }
      },
      {
        type: 'control',
        controlKind: CONTROL.STUN,
        sourceId: 'engineer.volatile-strain',
        name: 'Volatile Strain',
        metadata: { trigger: 'pierce' }
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 10,
        sourceId: 'engineer.titanic-strain',
        name: 'Titanic Strain',
        metadata: { trigger: 'obliterate' }
      },
      {
        type: 'boon',
        boon: BOON.QUICKNESS,
        duration: 8,
        sourceId: 'engineer.predator-strain',
        name: 'Predator Strain',
        metadata: { trigger: 'shred' }
      },
      {
        type: 'buff',
        kind: STATUS.SUPERSPEED,
        duration: 8,
        sourceId: 'engineer.predator-strain',
        name: 'Predator Strain',
        metadata: { trigger: 'shred' }
      },
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 8,
        stacks: 5,
        sourceId: 'engineer.berserker-strain',
        name: 'Berserker Strain',
        metadata: { trigger: 'demolish' }
      }
    ]
  }
]);
