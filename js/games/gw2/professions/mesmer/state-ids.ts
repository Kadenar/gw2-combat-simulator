/** Stable public identities belong to mechanics, independently of runtime names and display labels. */
export const MESMER_STATE_IDS = Object.freeze({
  CLARITY_REMAINING: 'gw2.mesmer.clarity-remaining',
  CONTINUUM_ACTIVE: 'gw2.chronomancer.continuum-active',
  CONTINUUM_REMAINING: 'gw2.chronomancer.continuum-remaining',
  ACTIVE_INSTRUMENTS: 'gw2.troubadour.active-instruments',
  NOTES: 'gw2.troubadour.notes',
  BLADES: 'gw2.virtuoso.blades'
} as const);
