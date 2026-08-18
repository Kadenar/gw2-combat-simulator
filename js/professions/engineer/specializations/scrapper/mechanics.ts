// Kinetic Accelerators (GM trait): successful blast/leap/whirl combos grant
// quickness and might. Only whirl-triggered applications have an ICD.
export const SCRAPPER_KINETIC_ACCELERATORS = Object.freeze({
  quicknessDuration: 3,
  mightStacks: 3,
  mightDuration: 10,
  whirlInternalCooldown: 3
});

// Mass Momentum (GM trait): while stability is active, pulses 1 might every second.
export const SCRAPPER_MASS_MOMENTUM = Object.freeze({
  // seconds between might grants; checked on every damage/buff event and on its own pulse event
  pulseInterval: 1,
  boonDuration: 5
});
