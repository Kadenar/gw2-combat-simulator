import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Forge toggles are excluded from ordinary tool-belt lockouts and have dedicated availability rules. */
export const HOLOSMITH_FORGE_TOGGLE_SKILL_IDS = new Set<number>([
  ID.ENGAGE_PHOTON_FORGE,
  ID.DEACTIVATE_PHOTON_FORGE,
  ID.DEACTIVATE_PHOTON_FORGE_HOT
]);

export const HOLOSMITH_HEAT = Object.freeze({
  // Base heat mechanics are independent of trait-owned capacity and enhanced tier thresholds.
  baseMaximum: 100,
  highThreshold: 50,
  // Passive heat and Overheat both advance every 100 ms from Forge entry.
  heatTickInterval: 0.1,
  // Cooling starts on a whole second after the delay. Its first five seconds use the slower rate.
  coolingDelay: 3,
  slowCoolingPerSecond: 5,
  slowCoolingDuration: 5,
  fastCoolingPerSecond: 10,
  // Observed delay from forge ejection to Overheat damage, the PBM blast, and
  // the tool-belt recharge penalty that the delayed effect applies.
  overheatEffectDelay: 1.56
});
