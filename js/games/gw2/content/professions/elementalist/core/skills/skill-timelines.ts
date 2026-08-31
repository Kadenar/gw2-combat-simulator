/** Canonical packet timelines shared by Core Elementalist skill families. */

/**
 * Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
 *
 * Shared timing options mixed into the timelines below so their offsets anchor
 * to cast start and stretch with the actual cast duration.
 */
export const CAST_SCALED_PACKET_TIMING = {
  timingAnchor: 'castStart',
  timingScale: 'cast'
} as const;

// Canonical tick timelines keep packet coefficients and same-time strike order explicit in skill data.
/** Frost Bow "Frost Storm" strike packets; its per-tick Bleeding reuses the same offsets after the first hit. */
export const FROST_STORM_STRIKE_TICKS = [
  { atMs: 1040, coefficient: 0.7 },
  { atMs: 1320, coefficient: 0.63 },
  { atMs: 1520, coefficient: 0.56 },
  { atMs: 1560, coefficient: 0.49 },
  { atMs: 1800, coefficient: 0.42 },
  { atMs: 1800, coefficient: 0.35 },
  { atMs: 2000, coefficient: 0.28 },
  { atMs: 2040, coefficient: 0.21 },
  { atMs: 2280, coefficient: 0.14 },
  { atMs: 2280, coefficient: 0.14 },
  { atMs: 2480, coefficient: 0.14 },
  { atMs: 2520, coefficient: 0.14 },
  { atMs: 2760, coefficient: 0.14 },
  { atMs: 2760, coefficient: 0.14 },
  { atMs: 2960, coefficient: 0.14 },
  { atMs: 3000, coefficient: 0.14 },
  { atMs: 3240, coefficient: 0.14 },
  { atMs: 3240, coefficient: 0.14 },
  { atMs: 3480, coefficient: 0.14 },
  { atMs: 3720, coefficient: 0.14 },
  { atMs: 3960, coefficient: 0.14 },
  { atMs: 4240, coefficient: 0.14 },
  { atMs: 4480, coefficient: 0.14 },
  { atMs: 4720, coefficient: 0.14 }
] as const;

/** Lightning Hammer "Invoke Lightning" strike packets, including its bursts of same-time hits. */
export const INVOKE_LIGHTNING_STRIKE_TICKS = [
  { atMs: 360, coefficient: 0.825 },
  { atMs: 360, coefficient: 0.7425 },
  { atMs: 360, coefficient: 0.66 },
  { atMs: 480, coefficient: 0.5775 },
  { atMs: 480, coefficient: 0.495 },
  { atMs: 480, coefficient: 0.4125 },
  { atMs: 600, coefficient: 0.33 },
  { atMs: 600, coefficient: 0.2475 },
  { atMs: 600, coefficient: 0.24 },
  { atMs: 760, coefficient: 0.24 },
  { atMs: 760, coefficient: 0.24 },
  { atMs: 760, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 880, coefficient: 0.24 },
  { atMs: 1000, coefficient: 0.24 },
  { atMs: 1000, coefficient: 0.24 }
] as const;

/** Glyph of Storms (Water) strike packets; the same offsets carry its Chilled application. */
export const GLYPH_OF_STORMS_WATER_STRIKE_TICKS = [
  { atMs: 1600, coefficient: 0.8 },
  { atMs: 1920, coefficient: 0.72 },
  { atMs: 2240, coefficient: 0.64 },
  { atMs: 2560, coefficient: 0.56 },
  { atMs: 2880, coefficient: 0.48 },
  { atMs: 3200, coefficient: 0.4 },
  { atMs: 3520, coefficient: 0.32 },
  { atMs: 3840, coefficient: 0.32 },
  { atMs: 4160, coefficient: 0.32 },
  { atMs: 4480, coefficient: 0.32 },
  { atMs: 4800, coefficient: 0.32 },
  { atMs: 5120, coefficient: 0.32 },
  { atMs: 5440, coefficient: 0.32 },
  { atMs: 5760, coefficient: 0.32 },
  { atMs: 6080, coefficient: 0.32 },
  { atMs: 6400, coefficient: 0.32 },
  { atMs: 6720, coefficient: 0.32 },
  { atMs: 7040, coefficient: 0.32 }
] as const;

// Layers interleave same-time Vulnerability after its originating hit without reverting to per-packet effects.
/** Glyph of Storms (Air) packets: one strike timeline per overlapping layer, each paired with its own Vulnerability timeline. */
export const GLYPH_OF_STORMS_AIR_STRIKE_TICK_LAYERS = [
  [
    { atMs: 880, coefficient: 0.825 },
    { atMs: 1400, coefficient: 0.70125 },
    { atMs: 1560, coefficient: 0.66 },
    { atMs: 1680, coefficient: 0.61875 },
    { atMs: 1890, coefficient: 0.5775 },
    { atMs: 2200, coefficient: 0.53625 },
    { atMs: 2400, coefficient: 0.495 },
    { atMs: 2480, coefficient: 0.45375 },
    { atMs: 2840, coefficient: 0.4125 },
    { atMs: 2880, coefficient: 0.37125 },
    { atMs: 3280, coefficient: 0.33 },
    { atMs: 3400, coefficient: 0.28875 },
    { atMs: 3480, coefficient: 0.2475 },
    { atMs: 3880, coefficient: 0.2475 },
    { atMs: 4080, coefficient: 0.2475 },
    { atMs: 4160, coefficient: 0.2475 },
    { atMs: 4400, coefficient: 0.2475 },
    { atMs: 4800, coefficient: 0.2475 },
    { atMs: 4880, coefficient: 0.2475 },
    { atMs: 5400, coefficient: 0.2475 },
    { atMs: 5440, coefficient: 0.2475 },
    { atMs: 5680, coefficient: 0.2475 },
    { atMs: 5880, coefficient: 0.2475 },
    { atMs: 6080, coefficient: 0.2475 },
    { atMs: 6400, coefficient: 0.2475 },
    { atMs: 6480, coefficient: 0.2475 },
    { atMs: 6760, coefficient: 0.2475 },
    { atMs: 7290, coefficient: 0.2475 },
    { atMs: 7400, coefficient: 0.2475 },
    { atMs: 8040, coefficient: 0.2475 },
    { atMs: 8080, coefficient: 0.2475 },
    { atMs: 8880, coefficient: 0.2475 },
    { atMs: 9680, coefficient: 0.2475 }
  ],
  [
    { atMs: 880, coefficient: 0.78375 },
    { atMs: 4880, coefficient: 0.2475 }
  ],
  [{ atMs: 880, coefficient: 0.7425 }]
] as const;

/** Fiery Greatsword "Fiery Whirl" strike packets; each is a whirl finisher and also carries Cripple. */
export const FIERY_WHIRL_STRIKE_TICKS = [
  { atMs: 280, coefficient: 0.688 },
  { atMs: 400, coefficient: 0.688 },
  { atMs: 530, coefficient: 0.688 },
  { atMs: 640, coefficient: 0.688 },
  { atMs: 760, coefficient: 0.688 },
  { atMs: 880, coefficient: 0.688 },
  { atMs: 990, coefficient: 0.688 },
  { atMs: 1130, coefficient: 0.688 }
] as const;

/** Frost Volley pulse offsets only; coefficients, finishers, and Vulnerability are attached at the call site. */
export const FROST_VOLLEY_TICK_OFFSETS_MS = [360, 680, 1000, 1320, 1640] as const;

/** Shared one-second field cadence for the Fire and Earth Glyph of Storms variants. */
export const GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS = [
  880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880
] as const;

/** Fiery Greatsword "Firestorm" field pulse offsets, one second apart. */
export const FIRESTORM_TICK_OFFSETS_MS = [520, 1520, 2520, 3520, 4520, 5520, 6520, 7520, 8520] as const;
