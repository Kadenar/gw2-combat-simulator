export const HOLOSMITH_HEAT = Object.freeze({
  // Heat capacity and tier boundaries are fixed profession mechanics; balance
  // profiles tune only the effects activated at those tiers.
  baseMaximum: 100,
  enhancedCapacityMaximum: 150,
  highThreshold: 50,
  // Passive heat rates are stored per second and apportioned across resource ticks.
  basePassivePerSecond: 2,
  // Additional passive heat per second from Light Density Amplifier.
  lightDensityBonusPerSecond: 1,
  // Passive heat and Overheat both advance every 100 ms from Forge entry.
  heatTickInterval: 0.1,
  // Cooling waits three seconds, loses 5%/s through eight seconds, then loses 10%/s.
  coolingDelay: 3,
  slowCoolingPerSecond: 5,
  fastCoolingStartsAt: 8,
  fastCoolingPerSecond: 10,
  // How long Solar Focusing Lens charges remain active (seconds).
  solarFocusingLensDuration: 4,
  // Heat at or above which Enhanced Capacity Storage Unit buffs activate.
  enhancedCapacityThreshold: 100,
  // Observed delay from forge ejection to Overheat damage, the PBM blast, and
  // the tool-belt recharge penalty that the delayed effect applies.
  overheatEffectDelay: 1.56
});

// Times (ms from cast start) at which Corona Burst deals damage and pulses heat.
// The 5 offsets correspond to the 5 pulses of the skill's quickness-scaled animation.
export const HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS = Object.freeze([400, 760, 1120, 1480, 1800]);

// Times (ms from cast start) at which each Photon Blitz projectile fires and pulses heat.
// Heat pulses are tied to projectile launch, not impact; all 8 pulses contribute 2 heat each (16 total).
export const HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS = Object.freeze([240, 400, 480, 640, 720, 880, 960, 1120]);
