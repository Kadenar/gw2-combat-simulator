import type { BalanceProfile } from '../../../../platform/engine/types.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';

export const HOLOSMITH_BALANCE_PROFILE_IDS = Object.freeze({
  heat: 'engineer.holosmith.heat',
  overheat: 'engineer.holosmith.overheat',
  swordHeatTier: 'engineer.holosmith.sword-heat-tier',
  bladeBurstHeatTier: 'engineer.holosmith.blade-burst-heat-tier',
  particleAcceleratorHeatTier: 'engineer.holosmith.particle-accelerator-heat-tier',
  laserDiskHeatTier: 'engineer.holosmith.laser-disk-heat-tier',
  launchWallHeatTier: 'engineer.holosmith.launch-wall-heat-tier',
  primeLightBeamHeatTier: 'engineer.holosmith.prime-light-beam-heat-tier',
  prismaticSingularityHeatTier: 'engineer.holosmith.prismatic-singularity-heat-tier',
  radiantArcHeatTier: 'engineer.holosmith.radiant-arc-heat-tier',
  refractionCutterHeatTier: 'engineer.holosmith.refraction-cutter-heat-tier',
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

const skillVariant = (id: string, name: string, fields: Readonly<Record<string, unknown>>): BalanceProfile => ({
  id,
  name,
  profileKind: 'skill-variant',
  categories: ['Skill variant'],
  effects: [],
  ...fields
});

export const HOLOSMITH_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: HOLOSMITH_BALANCE_PROFILE_IDS.heat,
    name: 'Photon Forge Heat',
    profileKind: 'mechanic',
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
    // The trait owns the dodge boon; the invoked Vent Exhaust skill owns its damage and heat loss.
    effects: [{ type: 'boon', boon: 'vigor', stacks: 1, duration: 3 }]
  }),
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.solarFocusingLens, 'Solar Focusing Lens', {
    minimumStacks: 2,
    maximumStacks: 6,
    durationMultiplier: 4,
    effects: [{ type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }]
  }),
  trait(HOLOSMITH_BALANCE_PROFILE_IDS.enhancedCapacity, 'Enhanced Capacity Storage Unit', {
    pulseInterval: 1,
    effects: [{ type: 'boon', boon: 'might', stacks: 2, duration: 6 }]
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.swordHeatTier, 'Holosmith Sword Heat Tier', {
    highStrikeFactor: 1.2,
    enhancedStrikeFactor: 1.3
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.bladeBurstHeatTier, 'Blade Burst Heat Tier', {
    highStrikeFactor: 1.25,
    enhancedStrikeFactor: 1.35
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.particleAcceleratorHeatTier, 'Particle Accelerator Heat Tier', {
    highStrikeFactor: 1.1,
    enhancedStrikeFactor: 1.35
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.laserDiskHeatTier, 'Laser Disk Heat Tier', {
    basePacketCount: 12,
    highPacketCount: 18,
    packetInterval: 0.52,
    enhancedStrikeFactor: 1.35,
    effects: [
      { type: 'strike', coefficient: 0.5, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 2 }
    ]
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.launchWallHeatTier, 'Launch Wall Heat Tier', {
    basePacketCount: 1,
    highPacketCount: 3,
    initialDelay: 0.48,
    enhancedStrikeFactor: 1.35,
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
      { type: 'condition', condition: 'Vulnerability', stacks: 3, duration: 5 }
    ]
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.primeLightBeamHeatTier, 'Prime Light Beam Heat Tier', {
    packetCount: 10,
    packetInterval: 1,
    enhancedStrikeFactor: 1.2,
    enhancedConditionBaseDurationFactor: 1.5,
    effects: [
      { type: 'strike', coefficient: 0.5, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 3 }
    ]
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.prismaticSingularityHeatTier, 'Prismatic Singularity Heat Tier', {
    enhancedStrikeFactor: 1.25
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.radiantArcHeatTier, 'Radiant Arc Heat Tier', {
    baseDuration: 2,
    highDuration: 4,
    enhancedDuration: 6
  }),
  skillVariant(HOLOSMITH_BALANCE_PROFILE_IDS.refractionCutterHeatTier, 'Refraction Cutter Heat Tier', {
    baseExtraBlades: 0,
    highExtraBlades: 2,
    enhancedExtraBlades: 4,
    initialDelay: 0.36,
    effects: [
      { type: 'strike', coefficient: 0.4, hits: 1 },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 4 }
    ]
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
