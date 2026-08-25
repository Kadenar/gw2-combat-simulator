export const HOLOSMITH_HEAT = Object.freeze({
  // Heat gained per second while Photon Forge is active (passive tick).
  basePassivePerSecond: 2,
  // Additional heat/s from Light Density Amplifier trait.
  lightDensityBonusPerSecond: 1,
  // Overheat is polled on the game's one-second resource tick instead of
  // firing immediately when a Forge skill fills the heat bar.
  overheatCheckInterval: 1,
  // How long Solar Focusing Lens charges remain active (seconds).
  solarFocusingLensDuration: 4,
  // Heat at or above which Enhanced Capacity Storage Unit buffs activate (max heat = 150 with ECSU, threshold stays 100).
  enhancedCapacityThreshold: 100,
  // Observed delay between overheat and Photonic Blasting Module explosion, in seconds.
  photonicBlastDelay: 1.56
});

// Times (ms from cast start) at which Corona Burst deals damage and pulses heat.
// The 5 offsets correspond to the 5 pulses of the skill's quickness-scaled animation.
export const HOLOSMITH_CORONA_QUICKNESS_PULSE_OFFSETS_MS = Object.freeze([400, 760, 1120, 1480, 1800]);

// Times (ms from cast start) at which each Photon Blitz projectile fires and pulses heat.
// Heat pulses are tied to projectile launch, not impact; all 8 pulses contribute 2 heat each (16 total).
export const HOLOSMITH_PHOTON_BLITZ_PULSE_OFFSETS_MS = Object.freeze([240, 400, 480, 640, 720, 880, 960, 1120]);
