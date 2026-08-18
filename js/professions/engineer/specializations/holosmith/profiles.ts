import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const HOLOSMITH_BALANCE_PROFILE_IDS = Object.freeze({
  heat: 'engineer.holosmith.heat',
  overheat: 'engineer.holosmith.overheat',
  thermalReleaseValve: TRAIT.THERMAL_RELEASE_VALVE,
  solarFocusingLens: TRAIT.SOLAR_FOCUSING_LENS,
  enhancedCapacity: TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
  photonicBlastingModule: TRAIT.PHOTONIC_BLASTING_MODULE
});

const trait = (id: number, name: string, fields: Readonly<Record<string, unknown>>): BalanceProfile => ({
  id,
  name,
  profileKind: 'trait',
  categories: ['Trait'],
  skillFamily: 'Trait',
  effects: [],
  ...fields
});

export const HOLOSMITH_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: HOLOSMITH_BALANCE_PROFILE_IDS.heat,
    name: 'Photon Forge Heat',
    profileKind: 'mechanic',
    maximumStacks: 100,
    threshold: 50,
    energyRegenerationPerSecond: 2,
    resourceGain: 1,
    cooldown: 6,
    effects: []
  },
  {
    id: HOLOSMITH_BALANCE_PROFILE_IDS.overheat,
    name: 'Photon Forge Overheat',
    profileKind: 'mechanic',
    minimumStacks: 3,
    threshold: 8,
    maximumStacks: 15,
    pulseInterval: 0.5,
    durationMultiplier: 2.5,
    effects: []
  },
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.thermalReleaseValve, 'Thermal Release Valve', {
    resourceCost: 15,
    effects: [
      { type: 'boon', boon: 'vigor', stacks: 1, duration: 3 },
      { type: 'strike', coefficient: 1.1, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 2, duration: 6 }
    ]
  }),
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.solarFocusingLens, 'Solar Focusing Lens', {
    minimumStacks: 2,
    maximumStacks: 6,
    durationMultiplier: 4,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }]
  }),
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.enhancedCapacity, 'Enhanced Capacity Storage Unit', {
    maximumStacks: 150,
    threshold: 100,
    pulseInterval: 1,
    effects: [{ type: 'boon', boon: 'might', stacks: 2, duration: 6 }]
  }),
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.photonicBlastingModule, 'Photonic Blasting Module', {
    initialDelay: 1.56,
    cooldown: 5,
    effects: [
      { type: 'strike', coefficient: 5, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 7, duration: 6 }
    ]
  })
]);
