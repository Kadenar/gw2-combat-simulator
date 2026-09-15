import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Forge toggles are excluded from ordinary tool-belt lockouts and have dedicated availability rules. */
export const HOLOSMITH_FORGE_TOGGLE_SKILL_IDS = new Set([
  ID.ENGAGE_PHOTON_FORGE,
  ID.DEACTIVATE_PHOTON_FORGE,
  ID.DEACTIVATE_PHOTON_FORGE_HOT
]);

/** Crystal Configuration: Storm selects these stable autoattack replacements. */
export const HOLOSMITH_STORM_AUTOATTACK_SKILL_IDS = new Set([
  ID.LIGHT_STRIKE_STORM,
  ID.BRIGHT_SLASH_STORM,
  ID.FLASH_CUTTER_STORM
]);

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
