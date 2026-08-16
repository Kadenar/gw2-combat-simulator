// Mass Momentum (GM trait): while stability is active, pulses 1 might every second.
export const SCRAPPER_MASS_MOMENTUM = Object.freeze({
  // seconds between might grants; checked on every damage/buff event and on its own pulse event
  pulseInterval: 1,
  boonDuration: 5,
});
